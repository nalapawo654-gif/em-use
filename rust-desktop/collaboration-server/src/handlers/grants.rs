//! Grant：Agent 所有者授予的「自动接单」授权范围、权限上限与时限。
//!
//! 对应设计文档 7.2 节表格。只有 Agent 的所有者（人）能创建/撤销自己 Agent 的
//! Grant；房主或其他成员不能代替 Agent 所有者授权（文档 3.3：
//! 「房主身份不能替代 Agent 所有者对本机的执行授权」）。
//! 第一版不做审批请求（approval_requests），因为审批内容依赖具体宿主，
//! 留给接执行适配器时再建。

use axum::{extract::State, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    auth::Principal,
    error::{AppError, AppResult},
    state::AppState,
};

/// 自动授权有效期上限：最长 8 小时（文档 7.2 默认值）。
const MAX_GRANT_TTL_HOURS: i64 = 8;

const PERMISSIONS: &[&str] = &["read_only", "edit_files", "execute_commands"];

#[derive(Deserialize)]
pub struct CreateGrantRequest {
    pub room_id: Option<Uuid>,
    pub task_creator_username: Option<String>,
    pub permission: String,
    #[serde(default)]
    pub auto_claim: bool,
    pub ttl_hours: Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct GrantOut {
    pub id: Uuid,
    pub agent_instance_id: Uuid,
    pub room_id: Option<Uuid>,
    pub task_creator_id: Option<Uuid>,
    pub permission: String,
    pub auto_claim: bool,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

async fn require_agent_owner(pool: &sqlx::PgPool, agent_id: Uuid, user_id: Uuid) -> AppResult<()> {
    let row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT user_id FROM agent_instances WHERE id = $1 AND revoked_at IS NULL AND user_id = $2",
    )
    .bind(agent_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    row.map(|_| ())
        .ok_or(AppError::NotFound("Agent 不存在或不属于当前用户"))
}

pub async fn create_grant(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(agent_id): axum::extract::Path<Uuid>,
    Json(req): Json<CreateGrantRequest>,
) -> AppResult<Json<GrantOut>> {
    principal.require_human()?;
    require_agent_owner(&state.pool, agent_id, principal.user_id).await?;
    if !PERMISSIONS.contains(&req.permission.as_str()) {
        return Err(AppError::BadRequest(format!(
            "permission 只能是 {}",
            PERMISSIONS.join("/")
        )));
    }
    let ttl = req.ttl_hours.unwrap_or(MAX_GRANT_TTL_HOURS);
    if ttl <= 0 || ttl > MAX_GRANT_TTL_HOURS {
        return Err(AppError::BadRequest(format!(
            "ttl_hours 必须在 1..{MAX_GRANT_TTL_HOURS} 之间"
        )));
    }
    let task_creator_id = if let Some(username) = &req.task_creator_username {
        let row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM users WHERE username = $1")
            .bind(username)
            .fetch_optional(&state.pool)
            .await?;
        Some(
            row.ok_or(AppError::NotFound("task_creator_username 对应的用户不存在"))?
                .0,
        )
    } else {
        None
    };
    let expires_at = Utc::now() + chrono::Duration::hours(ttl);
    let row: GrantOut = sqlx::query_as(
        r#"
        INSERT INTO grants (agent_instance_id, created_by, room_id, task_creator_id, permission, auto_claim, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, agent_instance_id, room_id, task_creator_id, permission, auto_claim, expires_at, created_at
        "#,
    )
    .bind(agent_id)
    .bind(principal.user_id)
    .bind(req.room_id)
    .bind(task_creator_id)
    .bind(&req.permission)
    .bind(req.auto_claim)
    .bind(expires_at)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}

pub async fn list_grants(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(agent_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<Vec<GrantOut>>> {
    principal.require_human()?;
    require_agent_owner(&state.pool, agent_id, principal.user_id).await?;
    let rows: Vec<GrantOut> = sqlx::query_as(
        r#"
        SELECT id, agent_instance_id, room_id, task_creator_id, permission, auto_claim, expires_at, created_at
        FROM grants
        WHERE agent_instance_id = $1 AND revoked_at IS NULL AND expires_at > clock_timestamp()
        ORDER BY created_at DESC
        "#,
    )
    .bind(agent_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn revoke_grant(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(grant_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    principal.require_human()?;
    let result = sqlx::query(
        r#"
        UPDATE grants SET revoked_at = now()
        WHERE id = $1 AND revoked_at IS NULL
          AND agent_instance_id IN (SELECT id FROM agent_instances WHERE user_id = $2)
        "#,
    )
    .bind(grant_id)
    .bind(principal.user_id)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Grant 不存在或不属于当前用户"));
    }
    Ok(Json(json!({ "ok": true })))
}

/// 权限等级比较：read_only < edit_files < execute_commands。
fn permission_rank(permission: &str) -> u8 {
    match permission {
        "read_only" => 0,
        "edit_files" => 1,
        "execute_commands" => 2,
        _ => 0,
    }
}

/// 查找一条能覆盖该自动启动请求的有效 Grant：未撤销、未过期、权限够、范围匹配。
/// room_id/task_creator_id 为 NULL 表示「不限」。
pub async fn find_matching_grant(
    pool: &mut sqlx::PgConnection,
    agent_instance_id: Uuid,
    room_id: Uuid,
    task_creator_id: Uuid,
    required_permission: &str,
) -> AppResult<Option<GrantOut>> {
    let rows: Vec<GrantOut> = sqlx::query_as(
        r#"
        SELECT id, agent_instance_id, room_id, task_creator_id, permission, auto_claim, expires_at, created_at
        FROM grants
        WHERE agent_instance_id = $1
          AND revoked_at IS NULL
          AND expires_at > clock_timestamp()
          AND auto_claim = true
          AND (room_id IS NULL OR room_id = $2)
          AND (task_creator_id IS NULL OR task_creator_id = $3)
        FOR SHARE
        "#,
    )
    .bind(agent_instance_id)
    .bind(room_id)
    .bind(task_creator_id)
    .fetch_all(pool)
    .await?;
    let required_rank = permission_rank(required_permission);
    Ok(rows
        .into_iter()
        .find(|g| permission_rank(&g.permission) >= required_rank))
}
