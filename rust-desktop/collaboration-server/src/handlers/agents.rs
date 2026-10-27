//! Agent 身份：一次性绑定码、绑定、心跳、能力/状态展示、撤销。
//!
//! 对应设计文档 3.1 / 3.2 / 6.2 节：AgentInstance 归属一个用户，绑定一个房间，
//! 声明宿主与能力；配对码一次性使用，和设备配对同一套哲学（文档 8 节）。
//! 这里不建 HostBinding（本机目录、会话 ID 等属于本机状态，留给接执行适配器时再决定
//! 是否上行到服务端）。

use axum::{extract::State, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    auth::{generate_token, hash_token, Principal},
    error::{AppError, AppResult},
    state::AppState,
};

const BIND_CODE_TTL_MINUTES: i64 = 30;

#[derive(Serialize)]
pub struct BindCodeOut {
    pub bind_code: String,
    pub expires_at: DateTime<Utc>,
}

/// 由房间成员生成一次性绑定码，交给要接入的宿主/Agent 完成绑定。
pub async fn create_bind_code(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<BindCodeOut>> {
    principal.require_human()?;
    principal.require_room(&state.pool, room_id).await?;
    let (plain, token_hash) = generate_token("bindcode");
    let expires_at = Utc::now() + chrono::Duration::minutes(BIND_CODE_TTL_MINUTES);
    sqlx::query(
        r#"
        INSERT INTO agent_bind_codes (room_id, created_by, token_hash, expires_at)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(room_id)
    .bind(principal.user_id)
    .bind(&token_hash)
    .bind(expires_at)
    .execute(&state.pool)
    .await?;
    Ok(Json(BindCodeOut {
        bind_code: plain,
        expires_at,
    }))
}

#[derive(Deserialize)]
pub struct BindAgentRequest {
    pub bind_code: String,
    pub host_kind: String,
    pub label: String,
    #[serde(default)]
    pub capabilities: Value,
}

#[derive(Serialize)]
pub struct BindAgentOut {
    pub agent_instance_id: Uuid,
    pub room_id: Uuid,
    pub agent_token: String,
}

const HOST_KINDS: &[&str] = &["codex", "dsh", "workbuddy", "aiwork", "ide", "other"];

/// 绑定码本身就是这一步的凭据——首次握手只建立身份，不代表宿主已经可用
/// （文档 3.2 第 6 步：「首次只做连接握手」）。
pub async fn bind_agent(
    State(state): State<AppState>,
    Json(req): Json<BindAgentRequest>,
) -> AppResult<Json<BindAgentOut>> {
    if !HOST_KINDS.contains(&req.host_kind.as_str()) {
        return Err(AppError::BadRequest(format!(
            "host_kind 只能是 {}",
            HOST_KINDS.join("/")
        )));
    }
    if req.label.trim().is_empty() {
        return Err(AppError::BadRequest("label 不能为空".to_string()));
    }
    let code_hash = hash_token(&req.bind_code);
    let mut tx = state.pool.begin().await?;
    let code: Option<(Uuid, Uuid, Uuid)> = sqlx::query_as(
        r#"
        SELECT id, room_id, created_by FROM agent_bind_codes
        WHERE token_hash = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
        FOR UPDATE
        "#,
    )
    .bind(&code_hash)
    .fetch_optional(&mut *tx)
    .await?;
    let (code_id, room_id, owner_user_id) =
        code.ok_or(AppError::Forbidden("绑定码不存在、已使用或已过期"))?;

    let can_bind: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id JOIN rooms r ON r.id=m.room_id WHERE m.room_id=$1 AND m.user_id=$2 AND m.status='active' AND u.status='active' AND r.status='active')")
        .bind(room_id).bind(owner_user_id).fetch_one(&mut *tx).await?;
    if !can_bind {
        return Err(AppError::Forbidden(
            "绑定码所有者不再是有效成员，或房间已归档",
        ));
    }
    let (plain, token_hash) = generate_token("agent");
    let instance: (Uuid,) = sqlx::query_as(
        r#"
        INSERT INTO agent_instances (user_id, room_id, bind_code_id, host_kind, label, capabilities, token_hash, status, last_seen_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'connected', now())
        RETURNING id
        "#,
    )
    .bind(owner_user_id)
    .bind(room_id)
    .bind(code_id)
    .bind(&req.host_kind)
    .bind(&req.label)
    .bind(&req.capabilities)
    .bind(&token_hash)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE agent_bind_codes SET used_at = now(), used_by_agent_instance_id = $1 WHERE id = $2",
    )
    .bind(instance.0)
    .bind(code_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(BindAgentOut {
        agent_instance_id: instance.0,
        room_id,
        agent_token: plain,
    }))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct AgentInstanceOut {
    pub id: Uuid,
    pub room_id: Uuid,
    pub owner_user_id: Uuid,
    pub owner_username: String,
    pub host_kind: String,
    pub label: String,
    pub capabilities: Value,
    pub status: String,
    pub auto_reply_enabled: bool,
    pub last_seen_at: Option<DateTime<Utc>>,
}

/// 房间内所有成员都能看到接入了哪些 Agent 及其连接状态（文档 6.2：
/// 「可调用 MCP」「可自动启动」等能力分别展示，不按宿主名字硬编码）。
pub async fn list_room_agents(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<Vec<AgentInstanceOut>>> {
    principal.require_room(&state.pool, room_id).await?;
    let rows: Vec<AgentInstanceOut> = sqlx::query_as(
        r#"
        SELECT a.id, a.room_id, a.user_id AS owner_user_id, u.username AS owner_username,
               a.host_kind, a.label, a.capabilities, a.status, a.auto_reply_enabled, a.last_seen_at
        FROM agent_instances a
        JOIN users u ON u.id = a.user_id
        WHERE a.room_id = $1 AND a.revoked_at IS NULL
        ORDER BY a.created_at ASC
        "#,
    )
    .bind(room_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct AgentSelfOut {
    pub id: Uuid,
    pub room_id: Uuid,
    pub host_kind: String,
    pub label: String,
    pub status: String,
    pub auto_reply_enabled: bool,
    pub acked_seq: i64,
}

/// Agent 自己查询自身状态（MCP/CLI 客户端重启后用它找回 room_id 和已处理到的游标）；
/// 所有者也可以用自己的会话/设备令牌查看。两者之外都拿不到。
pub async fn get_agent_self(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(agent_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<AgentSelfOut>> {
    let row: Option<AgentSelfOut> = sqlx::query_as(
        r#"
        SELECT id, room_id, host_kind, label, status, auto_reply_enabled, acked_seq
        FROM agent_instances WHERE id = $1 AND revoked_at IS NULL
        "#,
    )
    .bind(agent_id)
    .fetch_optional(&state.pool)
    .await?;
    let row = row.ok_or(AppError::NotFound("Agent 不存在"))?;
    if principal.agent_instance_id != Some(agent_id) {
        principal.require_human()?;
        load_owned_agent(&state.pool, agent_id, principal.user_id).await?;
    }
    Ok(Json(row))
}

async fn load_owned_agent(
    pool: &sqlx::PgPool,
    agent_id: Uuid,
    owner_user_id: Uuid,
) -> AppResult<()> {
    let row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT user_id FROM agent_instances WHERE id = $1 AND revoked_at IS NULL AND user_id = $2",
    )
    .bind(agent_id)
    .bind(owner_user_id)
    .fetch_optional(pool)
    .await?;
    row.map(|_| ())
        .ok_or(AppError::NotFound("Agent 不存在或不属于当前用户"))
}

#[derive(Deserialize)]
pub struct HeartbeatRequest {
    pub status: String,
    pub capabilities: Option<Value>,
}

const AGENT_STATUSES: &[&str] = &[
    "connected",
    "idle",
    "busy",
    "awaiting_authorization",
    "offline",
    "unknown",
];

/// 宿主适配器/MCP 客户端用 Agent 令牌定期上报状态；只有持有该令牌的一方能上报，
/// 不允许房主或其他成员代为修改（状态造假会误导「是否可以派任务」的判断）。
pub async fn heartbeat(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(agent_id): axum::extract::Path<Uuid>,
    Json(req): Json<HeartbeatRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if principal.agent_instance_id != Some(agent_id) {
        principal.require_human()?;
        return Err(AppError::Forbidden("只有该 Agent 自己的令牌可以上报心跳"));
    }
    if !AGENT_STATUSES.contains(&req.status.as_str()) {
        return Err(AppError::BadRequest(format!(
            "status 只能是 {}",
            AGENT_STATUSES.join("/")
        )));
    }
    if let Some(caps) = &req.capabilities {
        sqlx::query("UPDATE agent_instances SET status = $1, capabilities = $2, last_seen_at = now() WHERE id = $3")
            .bind(&req.status)
            .bind(caps)
            .bind(agent_id)
            .execute(&state.pool)
            .await?;
    } else {
        sqlx::query("UPDATE agent_instances SET status = $1, last_seen_at = now() WHERE id = $2")
            .bind(&req.status)
            .bind(agent_id)
            .execute(&state.pool)
            .await?;
    }
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct UpdateAgentRequest {
    pub auto_reply_enabled: Option<bool>,
    pub label: Option<String>,
}

/// 「Agent 自动发言」默认关闭，必须由 Agent 所有者（人）显式打开（文档 7.2 表格）。
pub async fn update_agent(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(agent_id): axum::extract::Path<Uuid>,
    Json(req): Json<UpdateAgentRequest>,
) -> AppResult<Json<serde_json::Value>> {
    principal.require_human()?;
    load_owned_agent(&state.pool, agent_id, principal.user_id).await?;
    if let Some(enabled) = req.auto_reply_enabled {
        sqlx::query("UPDATE agent_instances SET auto_reply_enabled = $1 WHERE id = $2")
            .bind(enabled)
            .bind(agent_id)
            .execute(&state.pool)
            .await?;
    }
    if let Some(label) = &req.label {
        if label.trim().is_empty() {
            return Err(AppError::BadRequest("label 不能为空".to_string()));
        }
        sqlx::query("UPDATE agent_instances SET label = $1 WHERE id = $2")
            .bind(label)
            .bind(agent_id)
            .execute(&state.pool)
            .await?;
    }
    Ok(Json(json!({ "ok": true })))
}

/// 撤销后 Agent 令牌立即失效（和设备撤销同语义），已发出的 Grant 一并失去意义
/// 但不单独清理——Grant 校验时会再核对 agent_instances.revoked_at。
pub async fn revoke_agent(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(agent_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    principal.require_human()?;
    let result = sqlx::query(
        "UPDATE agent_instances SET revoked_at = now(), status = 'offline' WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
    )
    .bind(agent_id)
    .bind(principal.user_id)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Agent 不存在或不属于当前用户"));
    }
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct AckRequest {
    pub seq: i64,
}

/// Agent 自己的房间读取游标：只推进该 Agent 的处理位置，不代替人类已读，
/// 也不影响任务完成判定——这是文档 7.3 说的四种不同事实之一（设备收到、
/// Agent 已处理、人已读、任务完成）。游标只能前进，不能后退或被其他主体代推。
pub async fn ack(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(agent_id): axum::extract::Path<Uuid>,
    Json(req): Json<AckRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if principal.agent_instance_id != Some(agent_id) {
        principal.require_human()?;
        return Err(AppError::Forbidden(
            "只有该 Agent 自己的令牌可以推进它的游标",
        ));
    }
    sqlx::query("UPDATE agent_instances SET acked_seq = GREATEST(acked_seq, $1) WHERE id = $2")
        .bind(req.seq)
        .bind(agent_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "ok": true })))
}
