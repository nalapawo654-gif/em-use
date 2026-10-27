//! 任务、Run 与成果：原子接单/启动、单活跃 Run、幂等启动、验收状态机。
//!
//! 对应设计文档 6.1 / 7.1 节的工具语义，这里直接以 HTTP 资源形式实现
//! （MCP/CLI 留给后续阶段，封装同一套接口，不另写一套权限逻辑）。

use axum::{
    extract::{Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    auth::Principal,
    error::{AppError, AppResult},
    handlers::grants::find_matching_grant,
    models::require_active_member,
    room_log::{append_event, next_seq, NewEvent},
    state::AppState,
};

const ACTIVE_RUN_STATUSES: &[&str] = &[
    "queued",
    "starting",
    "running",
    "awaiting_approval",
    "cancelling",
];

const PERMISSIONS: &[&str] = &["read_only", "edit_files", "execute_commands"];

#[derive(Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: String,
    pub acceptance_criteria: String,
    /// "directed" 需要 target_username；"open" 任何在职成员都可领取。
    pub assignment_mode: String,
    pub target_username: Option<String>,
    #[serde(default)]
    pub allowed_scope: Value,
    /// 自动执行必须有匹配权限 Grant；Agent 人工触发必须有人类签发的任务许可。
    /// 省略时默认 "read_only"。
    pub required_permission: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct TaskOut {
    pub id: Uuid,
    pub room_id: Uuid,
    pub created_by: Uuid,
    pub title: String,
    pub description: String,
    pub acceptance_criteria: String,
    pub allowed_scope: Value,
    pub assignment_mode: String,
    pub target_user_id: Option<Uuid>,
    pub assignee_user_id: Option<Uuid>,
    pub status: String,
    pub blocked_reason: Option<String>,
    pub required_permission: String,
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub async fn create_task(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
    Json(req): Json<CreateTaskRequest>,
) -> AppResult<Json<TaskOut>> {
    principal.require_human()?;
    principal.require_room(&state.pool, room_id).await?;
    if req.title.trim().is_empty() || req.description.trim().is_empty() {
        return Err(AppError::BadRequest("标题和目标不能为空".to_string()));
    }
    if !["directed", "open"].contains(&req.assignment_mode.as_str()) {
        return Err(AppError::BadRequest(
            "assignment_mode 只能是 directed 或 open".to_string(),
        ));
    }
    let required_permission = req
        .required_permission
        .clone()
        .unwrap_or_else(|| "read_only".to_string());
    if !PERMISSIONS.contains(&required_permission.as_str()) {
        return Err(AppError::BadRequest(format!(
            "required_permission 只能是 {}",
            PERMISSIONS.join("/")
        )));
    }
    let target_user_id = if req.assignment_mode == "directed" {
        let username = req.target_username.as_deref().ok_or_else(|| {
            AppError::BadRequest("directed 任务必须指定 target_username".to_string())
        })?;
        let row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM users WHERE username = $1")
            .bind(username)
            .fetch_optional(&state.pool)
            .await?;
        let (id,) = row.ok_or(AppError::NotFound("目标用户不存在"))?;
        require_active_member(&state.pool, room_id, id).await?;
        Some(id)
    } else {
        None
    };

    let mut tx = state.pool.begin().await?;
    let row: TaskOut = sqlx::query_as(
        r#"
        INSERT INTO tasks (room_id, created_by, title, description, acceptance_criteria, allowed_scope, assignment_mode, target_user_id, required_permission)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, room_id, created_by, title, description, acceptance_criteria, allowed_scope,
                  assignment_mode, target_user_id, assignee_user_id, status, blocked_reason, required_permission, version, created_at, updated_at
        "#,
    )
    .bind(room_id)
    .bind(principal.user_id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.acceptance_criteria)
    .bind(&req.allowed_scope)
    .bind(&req.assignment_mode)
    .bind(target_user_id)
    .bind(&required_permission)
    .fetch_one(&mut *tx)
    .await?;
    let seq = next_seq(&mut tx, room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id,
            seq,
            event_type: "task_created",
            entity_type: Some("task"),
            entity_id: Some(row.id),
            payload: json!({ "createdBy": principal.user_id, "assignmentMode": req.assignment_mode }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Deserialize)]
pub struct ListTasksQuery {
    pub status: Option<String>,
}

pub async fn list_tasks(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
    Query(q): Query<ListTasksQuery>,
) -> AppResult<Json<Vec<TaskOut>>> {
    principal.require_room(&state.pool, room_id).await?;
    let rows: Vec<TaskOut> = if let Some(status) = q.status {
        sqlx::query_as(
            r#"
            SELECT id, room_id, created_by, title, description, acceptance_criteria, allowed_scope,
                   assignment_mode, target_user_id, assignee_user_id, status, blocked_reason, required_permission, version, created_at, updated_at
            FROM tasks WHERE room_id = $1 AND status = $2 ORDER BY created_at DESC
            "#,
        )
        .bind(room_id)
        .bind(status)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as(
            r#"
            SELECT id, room_id, created_by, title, description, acceptance_criteria, allowed_scope,
                   assignment_mode, target_user_id, assignee_user_id, status, blocked_reason, required_permission, version, created_at, updated_at
            FROM tasks WHERE room_id = $1 ORDER BY created_at DESC
            "#,
        )
        .bind(room_id)
        .fetch_all(&state.pool)
        .await?
    };
    Ok(Json(rows))
}

async fn load_task_for_update(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    task_id: Uuid,
) -> AppResult<TaskOut> {
    let row: Option<TaskOut> = sqlx::query_as(
        r#"
        SELECT id, room_id, created_by, title, description, acceptance_criteria, allowed_scope,
               assignment_mode, target_user_id, assignee_user_id, status, blocked_reason, required_permission, version, created_at, updated_at
        FROM tasks WHERE id = $1 FOR UPDATE
        "#,
    )
    .bind(task_id)
    .fetch_optional(&mut **tx)
    .await?;
    row.ok_or(AppError::NotFound("任务不存在"))
}

#[derive(Deserialize)]
pub struct ClaimTaskRequest {
    pub expected_version: i32,
}

/// 原子领取：只改变负责人，不创建运行（设计文档 7.1）。
pub async fn claim_task(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(task_id): axum::extract::Path<Uuid>,
    Json(req): Json<ClaimTaskRequest>,
) -> AppResult<Json<TaskOut>> {
    let mut tx = state.pool.begin().await?;
    let task = load_task_for_update(&mut tx, task_id).await?;
    principal.require_room_on(&mut tx, task.room_id).await?;
    if task.status != "pending" {
        return Err(AppError::Conflict("任务不在待接单状态"));
    }
    if task.version != req.expected_version {
        return Err(AppError::VersionConflict {
            expected: req.expected_version,
            found: task.version,
        });
    }
    if task.assignment_mode == "directed" && task.target_user_id != Some(principal.user_id) {
        return Err(AppError::Forbidden("该任务指定了其他负责人，不能领取"));
    }

    let row: TaskOut = sqlx::query_as(
        r#"
        UPDATE tasks SET status = 'claimed', assignee_user_id = $1, version = version + 1, updated_at = now()
        WHERE id = $2
        RETURNING id, room_id, created_by, title, description, acceptance_criteria, allowed_scope,
                  assignment_mode, target_user_id, assignee_user_id, status, blocked_reason, required_permission, version, created_at, updated_at
        "#,
    )
    .bind(principal.user_id)
    .bind(task_id)
    .fetch_one(&mut *tx)
    .await?;
    let seq = next_seq(&mut tx, task.room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id: task.room_id,
            seq,
            event_type: "task_claimed",
            entity_type: Some("task"),
            entity_id: Some(task_id),
            payload: json!({ "assigneeUserId": principal.user_id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Deserialize)]
pub struct StartRunRequest {
    pub idempotency_key: String,
    pub execution_mode: String,
    pub authorization_token: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct RunOut {
    pub id: Uuid,
    pub task_id: Uuid,
    pub run_generation: i32,
    pub execution_mode: String,
    pub status: String,
    pub started_by: Uuid,
    pub started_via_agent_instance_id: Option<Uuid>,
    pub blocked_reason: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub lease_expires_at: Option<DateTime<Utc>>,
}

/// 启动一轮执行：只有负责人能启动，相同幂等键重复调用返回同一个 Run，
/// 数据库的单活跃 Run 唯一索引保证同一任务不会被并发启动两次。
///
/// auto 要求有效 Grant；Agent user_triggered 要求人类签发的单次任务许可。
pub async fn start_run(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(task_id): axum::extract::Path<Uuid>,
    Json(req): Json<StartRunRequest>,
) -> AppResult<Json<RunOut>> {
    if req.idempotency_key.trim().is_empty() {
        return Err(AppError::BadRequest("idempotency_key 不能为空".into()));
    }
    if !["auto", "user_triggered"].contains(&req.execution_mode.as_str()) {
        return Err(AppError::BadRequest(
            "execution_mode 只能是 auto 或 user_triggered".to_string(),
        ));
    }
    let mut tx = state.pool.begin().await?;
    let task = load_task_for_update(&mut tx, task_id).await?;
    principal.require_room_on(&mut tx, task.room_id).await?;
    if task.assignee_user_id != Some(principal.user_id) {
        return Err(AppError::Forbidden("只有任务负责人可以启动执行"));
    }
    expire_task_run(&mut tx, &task).await?;
    // 幂等：同一任务 + 同一幂等键已经启动过，直接返回原 Run，不重复创建。
    if let Some(existing) = fetch_run_by_idempotency(&mut tx, task_id, &req.idempotency_key).await?
    {
        require_run_owner(&principal, &existing)?;
        if existing.execution_mode != req.execution_mode {
            return Err(AppError::Conflict("幂等键的执行模式不匹配"));
        }
        tx.commit().await?;
        return Ok(Json(existing));
    }
    let unresolved: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM runs WHERE task_id=$1 AND status IN ('queued','starting','running','awaiting_approval','cancelling','unknown'))")
        .bind(task_id).fetch_one(&mut *tx).await?;
    if unresolved {
        tx.commit().await?;
        return Err(AppError::Conflict(
            "已有运行或状态未知的 Run；必须先确认停止并解决旧 Run",
        ));
    }
    if !["claimed", "blocked", "failed"].contains(&task.status.as_str()) {
        return Err(AppError::Conflict(
            "任务必须处于已接单 / 阻塞 / 失败状态才能启动新一轮执行",
        ));
    }
    if req.execution_mode == "auto" {
        let agent_instance_id = principal
            .agent_instance_id
            .ok_or(AppError::Forbidden("auto 执行模式必须使用 Agent 令牌调用"))?;
        let grant = find_matching_grant(
            &mut tx,
            agent_instance_id,
            task.room_id,
            task.created_by,
            &task.required_permission,
        )
        .await?;
        if grant.is_none() {
            return Err(AppError::Forbidden(
                "没有匹配的自动接单授权（Grant），无法以 auto 模式启动",
            ));
        }
    }
    if req.execution_mode == "user_triggered" {
        if let Some(agent_id) = principal.agent_instance_id {
            let token = req
                .authorization_token
                .as_deref()
                .ok_or(AppError::Forbidden(
                    "Agent 人工触发需要人类签发的一次性任务许可",
                ))?;
            let consumed = sqlx::query("UPDATE task_authorizations SET used_at=now() WHERE token_hash=$1 AND task_id=$2 AND agent_instance_id=$3 AND task_version=$4 AND used_at IS NULL AND expires_at>clock_timestamp()")
                .bind(crate::auth::hash_token(token)).bind(task_id).bind(agent_id).bind(task.version).execute(&mut *tx).await?;
            if consumed.rows_affected() != 1 {
                return Err(AppError::Forbidden(
                    "任务许可无效、已使用、已过期或任务版本变化",
                ));
            }
        }
    }
    let next_generation: (i32,) =
        sqlx::query_as("SELECT coalesce(max(run_generation), 0) + 1 FROM runs WHERE task_id = $1")
            .bind(task_id)
            .fetch_one(&mut *tx)
            .await?;

    let lease_expires_at = if req.execution_mode == "auto" {
        Some(Utc::now() + chrono::Duration::seconds(90))
    } else {
        Some(Utc::now() + chrono::Duration::minutes(15))
    };

    let run: RunOut = sqlx::query_as(
        r#"
        INSERT INTO runs (task_id, run_generation, execution_mode, status, started_by, started_via_agent_instance_id, idempotency_key, lease_expires_at)
        VALUES ($1, $2, $3, 'running', $4, $5, $6, $7)
        RETURNING id, task_id, run_generation, execution_mode, status, started_by, started_via_agent_instance_id, blocked_reason, started_at, ended_at, lease_expires_at
        "#,
    )
    .bind(task_id)
    .bind(next_generation.0)
    .bind(&req.execution_mode)
    .bind(principal.user_id)
    .bind(principal.agent_instance_id)
    .bind(&req.idempotency_key)
    .bind(lease_expires_at)
    .fetch_one(&mut *tx)
    .await
    .map_err(|err| match &err {
        sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
            AppError::Conflict("该任务已有一个正在进行的 Run，不能并发启动第二个")
        }
        _ => AppError::Database(err),
    })?;

    sqlx::query("UPDATE tasks SET status = 'in_progress', blocked_reason = NULL, version = version + 1, updated_at = now() WHERE id = $1")
        .bind(task_id)
        .execute(&mut *tx)
        .await?;
    let seq = next_seq(&mut tx, task.room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id: task.room_id,
            seq,
            event_type: "run_started",
            entity_type: Some("run"),
            entity_id: Some(run.id),
            payload: json!({ "taskId": task_id, "executionMode": req.execution_mode, "runGeneration": run.run_generation }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(run))
}

async fn fetch_run_by_idempotency(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    task_id: Uuid,
    idempotency_key: &str,
) -> AppResult<Option<RunOut>> {
    let row: Option<RunOut> = sqlx::query_as(
        r#"
        SELECT id, task_id, run_generation, execution_mode, status, started_by, started_via_agent_instance_id, blocked_reason, started_at, ended_at, lease_expires_at
        FROM runs WHERE task_id = $1 AND idempotency_key = $2
        "#,
    )
    .bind(task_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row)
}

#[derive(Deserialize)]
pub struct UpdateRunRequest {
    /// "progress" | "blocked" | "failed"
    pub kind: String,
    pub note: Option<String>,
}

pub async fn update_run(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(run_id): axum::extract::Path<Uuid>,
    Json(req): Json<UpdateRunRequest>,
) -> AppResult<Json<RunOut>> {
    if !["progress", "blocked", "failed", "cancelled"].contains(&req.kind.as_str()) {
        return Err(AppError::BadRequest(
            "kind 只能是 progress / blocked / failed / cancelled".to_string(),
        ));
    }
    let mut tx = state.pool.begin().await?;
    let task_id: Uuid = sqlx::query_scalar("SELECT task_id FROM runs WHERE id=$1")
        .bind(run_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound("Run 不存在"))?;
    let task = load_task_for_update(&mut tx, task_id).await?;
    principal.require_room_on(&mut tx, task.room_id).await?;
    expire_task_run(&mut tx, &task).await?;
    let run = fetch_run(&mut tx, run_id).await?;
    require_run_owner(&principal, &run)?;
    if run.status == "unknown" {
        tx.commit().await?;
        return Err(AppError::Conflict(
            "租约已过期或取消未确认，请由人类确认停止后解决",
        ));
    }
    if task.assignee_user_id != Some(principal.user_id) {
        return Err(AppError::Forbidden("只有任务负责人可以上报该 Run 的状态"));
    }
    if !ACTIVE_RUN_STATUSES.contains(&run.status.as_str()) {
        return Err(AppError::Conflict("该 Run 已结束，不能再上报状态"));
    }

    if (run.status == "cancelling") != (req.kind == "cancelled") {
        return Err(AppError::Conflict("取消中的 Run 只接受停止确认 cancelled"));
    }
    if req.kind != "cancelled" {
        require_current_grant(&mut tx, &task, &run).await?;
    }
    let updated: RunOut = match req.kind.as_str() {
        "progress" => {
            sqlx::query("UPDATE runs SET lease_expires_at = $1 WHERE id = $2")
                .bind(Utc::now() + lease_duration(&run.execution_mode))
                .bind(run_id)
                .execute(&mut *tx)
                .await?;
            fetch_run(&mut tx, run_id).await?
        }
        "blocked" => {
            let reason = req.note.clone().unwrap_or_default();
            sqlx::query(
                "UPDATE runs SET status = 'awaiting_approval', blocked_reason = $1 WHERE id = $2",
            )
            .bind(&reason)
            .bind(run_id)
            .execute(&mut *tx)
            .await?;
            sqlx::query("UPDATE tasks SET status = 'blocked', blocked_reason = $1, version = version + 1, updated_at = now() WHERE id = $2")
                .bind(&reason)
                .bind(run.task_id)
                .execute(&mut *tx)
                .await?;
            fetch_run(&mut tx, run_id).await?
        }
        "cancelled" => {
            sqlx::query("UPDATE runs SET status='cancelled', ended_at=now(), lease_expires_at=NULL WHERE id=$1").bind(run_id).execute(&mut *tx).await?;
            sqlx::query("UPDATE tasks SET status='cancelled', version=version+1, updated_at=now() WHERE id=$1").bind(task.id).execute(&mut *tx).await?;
            fetch_run(&mut tx, run_id).await?
        }
        "failed" => {
            sqlx::query("UPDATE runs SET status = 'failed', blocked_reason = $1, ended_at = now() WHERE id = $2")
                .bind(&req.note)
                .bind(run_id)
                .execute(&mut *tx)
                .await?;
            sqlx::query("UPDATE tasks SET status = 'failed', blocked_reason = $1, version = version + 1, updated_at = now() WHERE id = $2")
                .bind(&req.note)
                .bind(run.task_id)
                .execute(&mut *tx)
                .await?;
            fetch_run(&mut tx, run_id).await?
        }
        _ => unreachable!(),
    };
    let seq = next_seq(&mut tx, task.room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id: task.room_id,
            seq,
            event_type: "run_updated",
            entity_type: Some("run"),
            entity_id: Some(run_id),
            payload: json!({ "kind": req.kind, "note": req.note }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(updated))
}

async fn fetch_run(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    run_id: Uuid,
) -> AppResult<RunOut> {
    let row: RunOut = sqlx::query_as(
        r#"
        SELECT id, task_id, run_generation, execution_mode, status, started_by, started_via_agent_instance_id, blocked_reason, started_at, ended_at, lease_expires_at
        FROM runs WHERE id = $1
        "#,
    )
    .bind(run_id)
    .fetch_one(&mut **tx)
    .await?;
    Ok(row)
}

/// 请求取消：排队/启动中可直接判定取消；运行中进入「取消中」等待确认
/// （设计文档 3.4：撤销任务有效性并提醒用户，不能保证宿主已经停止）。
pub async fn cancel_run(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(run_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<RunOut>> {
    let mut tx = state.pool.begin().await?;
    let task_id: Uuid = sqlx::query_scalar("SELECT task_id FROM runs WHERE id=$1")
        .bind(run_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound("Run 不存在"))?;
    let task = load_task_for_update(&mut tx, task_id).await?;
    let role = principal.require_room_on(&mut tx, task.room_id).await?;
    expire_task_run(&mut tx, &task).await?;
    let run = fetch_run(&mut tx, run_id).await?;
    if principal.agent_instance_id.is_some() {
        require_run_owner(&principal, &run)?;
    }
    if task.assignee_user_id != Some(principal.user_id)
        && task.created_by != principal.user_id
        && !["owner", "admin"].contains(&role.as_str())
    {
        return Err(AppError::Forbidden("只有负责人、发布者或管理员可请求取消"));
    }
    if run.status == "unknown" {
        tx.commit().await?;
        return Err(AppError::Conflict("Run 状态未知，必须确认宿主停止后解决"));
    }
    if !ACTIVE_RUN_STATUSES.contains(&run.status.as_str()) {
        return Err(AppError::Conflict("该 Run 已结束，无需取消"));
    }
    if run.status == "cancelling" {
        tx.commit().await?;
        return Ok(Json(run));
    }
    let (new_status, task_terminal) = if matches!(run.status.as_str(), "queued" | "starting") {
        ("cancelled", true)
    } else {
        ("cancelling", false)
    };
    let ended_at_clause = if task_terminal {
        "ended_at = now(),"
    } else {
        ""
    };
    sqlx::query(&format!(
        "UPDATE runs SET status = $1, {ended_at_clause} lease_expires_at = CASE WHEN $1 = 'cancelled' THEN NULL ELSE now() + interval '90 seconds' END WHERE id = $2"
    ))
    .bind(new_status)
    .bind(run_id)
    .execute(&mut *tx)
    .await?;
    if task_terminal {
        sqlx::query("UPDATE tasks SET status = 'cancelled', version = version + 1, updated_at = now() WHERE id = $1")
            .bind(run.task_id)
            .execute(&mut *tx)
            .await?;
    }
    let seq = next_seq(&mut tx, task.room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id: task.room_id,
            seq,
            event_type: "run_cancel_requested",
            entity_type: Some("run"),
            entity_id: Some(run_id),
            payload: json!({ "requestedBy": principal.user_id, "resultingStatus": new_status }),
        },
    )
    .await?;
    tx.commit().await?;
    let mut tx = state.pool.begin().await?;
    let updated = fetch_run(&mut tx, run_id).await?;
    tx.commit().await?;
    Ok(Json(updated))
}

#[derive(Deserialize)]
pub struct SubmitArtifactRequest {
    pub run_id: Uuid,
    pub kind: String,
    pub content: String,
    pub verification_summary: String,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct ArtifactOut {
    pub id: Uuid,
    pub task_id: Uuid,
    pub run_id: Uuid,
    pub submitted_by: Uuid,
    pub kind: String,
    pub content: String,
    pub content_hash: String,
    pub size_bytes: i64,
    pub verification_summary: String,
    pub created_at: DateTime<Utc>,
}

/// 提交成果：结束该 Run（成功）并把任务转入待验收（设计文档 6.1 `artifact_submit`）。
pub async fn submit_artifact(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(task_id): axum::extract::Path<Uuid>,
    Json(req): Json<SubmitArtifactRequest>,
) -> AppResult<Json<ArtifactOut>> {
    if !["text", "markdown", "json", "log", "diff"].contains(&req.kind.as_str()) {
        return Err(AppError::BadRequest(
            "kind 只能是 text/markdown/json/log/diff".to_string(),
        ));
    }
    if req.verification_summary.trim().is_empty() {
        return Err(AppError::BadRequest(
            "verification_summary 必须说明测试通过/失败/未执行，不能空着".to_string(),
        ));
    }
    let size_bytes = req.content.len() as i64;
    if size_bytes > 10 * 1024 * 1024 {
        return Err(AppError::BadRequest("成果文件不能超过 10 MiB".to_string()));
    }

    let mut tx = state.pool.begin().await?;
    let task = load_task_for_update(&mut tx, task_id).await?;
    principal.require_room_on(&mut tx, task.room_id).await?;
    if task.assignee_user_id != Some(principal.user_id) {
        return Err(AppError::Forbidden("只有任务负责人可以提交成果"));
    }
    expire_task_run(&mut tx, &task).await?;
    let run = fetch_run(&mut tx, req.run_id)
        .await
        .map_err(|_| AppError::NotFound("Run 不存在"))?;
    if run.task_id != task_id {
        return Err(AppError::BadRequest("run_id 与 task_id 不匹配".to_string()));
    }
    require_run_owner(&principal, &run)?;
    if run.status == "unknown" {
        tx.commit().await?;
        return Err(AppError::Conflict(
            "租约过期，成果不能推进任务；请先人工解决旧 Run",
        ));
    }
    if !["running", "awaiting_approval"].contains(&run.status.as_str()) {
        return Err(AppError::Conflict(
            "Run 已取消、正在取消或已结束，不能提交有效成果",
        ));
    }

    require_current_grant(&mut tx, &task, &run).await?;
    let content_hash = {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(req.content.as_bytes());
        hex::encode(hasher.finalize())
    };
    let artifact: ArtifactOut = sqlx::query_as(
        r#"
        INSERT INTO artifacts (task_id, run_id, submitted_by, kind, content, content_hash, size_bytes, verification_summary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, task_id, run_id, submitted_by, kind, content, content_hash, size_bytes, verification_summary, created_at
        "#,
    )
    .bind(task_id)
    .bind(req.run_id)
    .bind(principal.user_id)
    .bind(&req.kind)
    .bind(&req.content)
    .bind(&content_hash)
    .bind(size_bytes)
    .bind(&req.verification_summary)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE runs SET status = 'succeeded', ended_at = now() WHERE id = $1")
        .bind(req.run_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE tasks SET status = 'pending_review', version = version + 1, updated_at = now() WHERE id = $1")
        .bind(task_id)
        .execute(&mut *tx)
        .await?;
    let seq = next_seq(&mut tx, task.room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id: task.room_id,
            seq,
            event_type: "artifact_submitted",
            entity_type: Some("artifact"),
            entity_id: Some(artifact.id),
            payload: json!({ "taskId": task_id, "runId": req.run_id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(artifact))
}

#[derive(Deserialize)]
pub struct ReviewTaskRequest {
    pub decision: String,
    pub reason: Option<String>,
    pub artifact_id: Option<Uuid>,
}

/// 验收：发布者或房间管理员确认；退回让任务回到「已接单」等待负责人重新启动，
/// 不能复用旧结果冒充新尝试（设计文档 3.3 / 7.1）。
pub async fn review_task(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(task_id): axum::extract::Path<Uuid>,
    Json(req): Json<ReviewTaskRequest>,
) -> AppResult<Json<TaskOut>> {
    principal.require_human()?;
    if !["accepted", "rejected"].contains(&req.decision.as_str()) {
        return Err(AppError::BadRequest(
            "decision 只能是 accepted 或 rejected".to_string(),
        ));
    }
    let mut tx = state.pool.begin().await?;
    let task = load_task_for_update(&mut tx, task_id).await?;
    let role = principal.require_room_on(&mut tx, task.room_id).await?;
    let can_review =
        task.created_by == principal.user_id || ["owner", "admin"].contains(&role.as_str());
    if !can_review {
        return Err(AppError::Forbidden("只有任务发布者或房间管理员可以验收"));
    }
    if task.status != "pending_review" {
        return Err(AppError::Conflict("任务不在待验收状态"));
    }

    let artifact_id: Option<Uuid> = sqlx::query_scalar("SELECT a.id FROM artifacts a JOIN runs r ON r.id=a.run_id WHERE a.task_id=$1 AND r.status='succeeded' AND r.run_generation=(SELECT max(run_generation) FROM runs WHERE task_id=$1) AND ($2::uuid IS NULL OR a.id=$2) ORDER BY a.created_at DESC LIMIT 1")
        .bind(task_id).bind(req.artifact_id).fetch_optional(&mut *tx).await?;
    let artifact_id = artifact_id.ok_or(AppError::BadRequest(
        "成果不属于本任务最新成功的 Run".into(),
    ))?;
    sqlx::query(
        "INSERT INTO reviews (task_id, artifact_id, reviewer_id, decision, reason) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(task_id)
    .bind(artifact_id)
    .bind(principal.user_id)
    .bind(&req.decision)
    .bind(&req.reason)
    .execute(&mut *tx)
    .await?;

    let new_status = if req.decision == "accepted" {
        "completed"
    } else {
        "claimed"
    };
    let row: TaskOut = sqlx::query_as(
        r#"
        UPDATE tasks SET status = $1, version = version + 1, updated_at = now()
        WHERE id = $2
        RETURNING id, room_id, created_by, title, description, acceptance_criteria, allowed_scope,
                  assignment_mode, target_user_id, assignee_user_id, status, blocked_reason, required_permission, version, created_at, updated_at
        "#,
    )
    .bind(new_status)
    .bind(task_id)
    .fetch_one(&mut *tx)
    .await?;
    let seq = next_seq(&mut tx, task.room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id: task.room_id,
            seq,
            event_type: "task_reviewed",
            entity_type: Some("task"),
            entity_id: Some(task_id),
            payload: json!({ "decision": req.decision, "reviewerId": principal.user_id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

fn lease_duration(mode: &str) -> chrono::Duration {
    if mode == "auto" {
        chrono::Duration::seconds(90)
    } else {
        chrono::Duration::minutes(15)
    }
}

fn require_run_owner(principal: &Principal, run: &RunOut) -> AppResult<()> {
    if principal.user_id != run.started_by
        || (principal.agent_instance_id.is_some()
            && principal.agent_instance_id != run.started_via_agent_instance_id)
    {
        return Err(AppError::Forbidden(
            "只有启动该 Run 的用户或 Agent 可以上报",
        ));
    }
    Ok(())
}

/// Called only while holding the task row lock. A timeout never proves process termination.
async fn expire_task_run(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    task: &TaskOut,
) -> AppResult<()> {
    let expired: Vec<Uuid> = sqlx::query_scalar("UPDATE runs SET status='unknown', blocked_reason='lease_expired' WHERE task_id=$1 AND status IN ('queued','starting','running','awaiting_approval','cancelling') AND (lease_expires_at IS NULL OR lease_expires_at <= clock_timestamp()) RETURNING id")
        .bind(task.id).fetch_all(&mut **tx).await?;
    for id in expired {
        sqlx::query("UPDATE tasks SET status='blocked', blocked_reason='execution_unknown', version=version+1, updated_at=now() WHERE id=$1").bind(task.id).execute(&mut **tx).await?;
        let seq = next_seq(tx, task.room_id).await?;
        append_event(
            tx,
            NewEvent {
                room_id: task.room_id,
                seq,
                event_type: "run_unknown",
                entity_type: Some("run"),
                entity_id: Some(id),
                payload: json!({"reason":"lease_expired","taskId":task.id}),
            },
        )
        .await?;
    }
    Ok(())
}

pub async fn expire_runs(pool: &sqlx::PgPool) -> AppResult<()> {
    let ids: Vec<Uuid> = sqlx::query_scalar("SELECT DISTINCT task_id FROM runs WHERE status IN ('queued','starting','running','awaiting_approval','cancelling') AND (lease_expires_at IS NULL OR lease_expires_at <= clock_timestamp()) LIMIT 100")
        .fetch_all(pool).await?;
    for id in ids {
        let mut tx = pool.begin().await?;
        let task = load_task_for_update(&mut tx, id).await?;
        expire_task_run(&mut tx, &task).await?;
        tx.commit().await?;
    }
    Ok(())
}

#[derive(Deserialize)]
pub struct AuthorizeTaskRequest {
    pub agent_instance_id: Uuid,
    pub expected_version: i32,
}

pub async fn authorize_task(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(task_id): axum::extract::Path<Uuid>,
    Json(req): Json<AuthorizeTaskRequest>,
) -> AppResult<Json<Value>> {
    principal.require_human()?;
    let mut tx = state.pool.begin().await?;
    let task = load_task_for_update(&mut tx, task_id).await?;
    principal.require_room_on(&mut tx, task.room_id).await?;
    if task.assignee_user_id != Some(principal.user_id) {
        return Err(AppError::Forbidden("只能授权自己负责的任务"));
    }
    if task.version != req.expected_version {
        return Err(AppError::VersionConflict {
            expected: req.expected_version,
            found: task.version,
        });
    }
    if !["claimed", "blocked", "failed"].contains(&task.status.as_str()) {
        return Err(AppError::Conflict("任务当前不可启动"));
    }
    let valid: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM agent_instances WHERE id=$1 AND user_id=$2 AND room_id=$3 AND revoked_at IS NULL)")
        .bind(req.agent_instance_id).bind(principal.user_id).bind(task.room_id).fetch_one(&mut *tx).await?;
    if !valid {
        return Err(AppError::Forbidden("只能授权自己在本房间绑定的 Agent"));
    }
    let (token, hash) = crate::auth::generate_token("permit");
    let expires = Utc::now() + chrono::Duration::minutes(15);
    sqlx::query("INSERT INTO task_authorizations(task_id,agent_instance_id,created_by,task_version,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6)")
        .bind(task_id).bind(req.agent_instance_id).bind(principal.user_id).bind(task.version).bind(hash).bind(expires).execute(&mut *tx).await?;
    let seq = next_seq(&mut tx, task.room_id).await?;
    append_event(&mut tx,NewEvent {room_id:task.room_id,seq,event_type:"task_authorized",entity_type:Some("task"),entity_id:Some(task_id),payload:json!({"agentInstanceId":req.agent_instance_id,"authorizedBy":principal.user_id,"taskVersion":task.version})}).await?;
    tx.commit().await?;
    Ok(Json(
        json!({"authorization_token":token,"expires_at":expires,"task_version":task.version}),
    ))
}

#[derive(Deserialize)]
pub struct ResolveRunRequest {
    pub confirmed_stopped: bool,
    pub outcome: String,
    pub note: String,
}

pub async fn resolve_run(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(run_id): axum::extract::Path<Uuid>,
    Json(req): Json<ResolveRunRequest>,
) -> AppResult<Json<RunOut>> {
    principal.require_human()?;
    if !req.confirmed_stopped
        || req.note.trim().is_empty()
        || !["failed", "cancelled"].contains(&req.outcome.as_str())
    {
        return Err(AppError::BadRequest(
            "需要确认宿主已停止、填写依据，并选择 failed 或 cancelled".into(),
        ));
    }
    let mut tx = state.pool.begin().await?;
    let task_id: Uuid = sqlx::query_scalar("SELECT task_id FROM runs WHERE id=$1")
        .bind(run_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound("Run 不存在"))?;
    let task = load_task_for_update(&mut tx, task_id).await?;
    let role = principal.require_room_on(&mut tx, task.room_id).await?;
    if task.assignee_user_id != Some(principal.user_id)
        && task.created_by != principal.user_id
        && !["owner", "admin"].contains(&role.as_str())
    {
        return Err(AppError::Forbidden(
            "只有负责人、发布者或管理员可以解决未知运行",
        ));
    }
    expire_task_run(&mut tx, &task).await?;
    let run = fetch_run(&mut tx, run_id).await?;
    if !["unknown", "cancelling"].contains(&run.status.as_str()) {
        return Err(AppError::Conflict(
            "只允许解决 unknown 或 cancelling 的 Run",
        ));
    }
    sqlx::query("UPDATE runs SET status=$1, ended_at=now(), lease_expires_at=NULL, blocked_reason=$2 WHERE id=$3").bind(&req.outcome).bind(&req.note).bind(run_id).execute(&mut *tx).await?;
    sqlx::query("UPDATE tasks SET status=$1, blocked_reason=$2, version=version+1, updated_at=now() WHERE id=$3").bind(&req.outcome).bind(&req.note).bind(task_id).execute(&mut *tx).await?;
    let seq = next_seq(&mut tx, task.room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id: task.room_id,
            seq,
            event_type: "run_resolved_by_human",
            entity_type: Some("run"),
            entity_id: Some(run_id),
            payload: json!({"resolvedBy":principal.user_id,"outcome":req.outcome,"note":req.note}),
        },
    )
    .await?;
    let updated = fetch_run(&mut tx, run_id).await?;
    tx.commit().await?;
    Ok(Json(updated))
}

pub async fn get_run(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(run_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<RunOut>> {
    let mut tx = state.pool.begin().await?;
    let task_id: Uuid = sqlx::query_scalar("SELECT task_id FROM runs WHERE id=$1")
        .bind(run_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound("Run 不存在"))?;
    let task = load_task_for_update(&mut tx, task_id).await?;
    principal.require_room_on(&mut tx, task.room_id).await?;
    expire_task_run(&mut tx, &task).await?;
    let run = fetch_run(&mut tx, run_id).await?;
    tx.commit().await?;
    Ok(Json(run))
}

#[derive(Deserialize)]
pub struct ArtifactsQuery {
    pub after_id: Option<Uuid>,
    pub limit: Option<i64>,
}

pub async fn list_artifacts(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(task_id): axum::extract::Path<Uuid>,
    Query(q): Query<ArtifactsQuery>,
) -> AppResult<Json<Vec<Value>>> {
    let room_id: Uuid = sqlx::query_scalar("SELECT room_id FROM tasks WHERE id=$1")
        .bind(task_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound("任务不存在"))?;
    principal.require_room(&state.pool, room_id).await?;
    let rows=sqlx::query_scalar("SELECT to_jsonb(a)-'content' FROM artifacts a WHERE task_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3")
        .bind(task_id).bind(q.after_id).bind(q.limit.unwrap_or(50).clamp(1,100)).fetch_all(&state.pool).await?;
    Ok(Json(rows))
}

pub async fn get_artifact(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path((task_id, artifact_id)): axum::extract::Path<(Uuid, Uuid)>,
) -> AppResult<Json<ArtifactOut>> {
    let room_id: Uuid = sqlx::query_scalar("SELECT room_id FROM tasks WHERE id=$1")
        .bind(task_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::NotFound("任务不存在"))?;
    principal.require_room(&state.pool, room_id).await?;
    let row=sqlx::query_as("SELECT id,task_id,run_id,submitted_by,kind,content,content_hash,size_bytes,verification_summary,created_at FROM artifacts WHERE id=$1 AND task_id=$2")
        .bind(artifact_id).bind(task_id).fetch_optional(&state.pool).await?.ok_or(AppError::NotFound("成果不存在或不属于该任务"))?;
    Ok(Json(row))
}

async fn require_current_grant(
    conn: &mut sqlx::PgConnection,
    task: &TaskOut,
    run: &RunOut,
) -> AppResult<()> {
    if run.execution_mode == "auto" {
        let agent = run
            .started_via_agent_instance_id
            .ok_or(AppError::Forbidden("自动 Run 缺少 Agent 身份"))?;
        if find_matching_grant(
            conn,
            agent,
            task.room_id,
            task.created_by,
            &task.required_permission,
        )
        .await?
        .is_none()
        {
            return Err(AppError::Forbidden(
                "自动执行授权已失效，请停止执行并请求取消",
            ));
        }
    }
    Ok(())
}
