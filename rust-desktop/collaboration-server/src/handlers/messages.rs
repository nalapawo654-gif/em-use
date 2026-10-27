//! 房间消息：幂等发送、增量历史、Agent 自动发言限额。
//!
//! 幂等键按房间唯一（设计文档 7.3：相同幂等键返回原结果，不允许盲目重发产生重复发言）。
//! Agent 自动发言默认关闭，且受频率与因果链长度限制（文档 7.2 表格）：
//!   * 每个 Agent 每分钟最多 6 条自动回复；
//!   * 每条因果对话链最多连续 4 次自动回复，再等待人工继续；
//!   * 只响应明确提及/回复（必须带 reply_to_id），不响应自身消息。
//!
//! 这些规则在服务端强制，不交给模型自己记住。

use axum::{
    extract::{Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{
    auth::Principal,
    error::{AppError, AppResult},
    room_log::{append_event, next_seq, NewEvent},
    state::AppState,
};

/// 每个 Agent 每分钟最多自动发言次数（文档 7.2 默认值）。
const AGENT_AUTO_REPLY_RATE_LIMIT: i64 = 6;
/// 每条因果链最多连续自动回复次数，达到后必须等待人工继续（文档 7.2 默认值）。
const AGENT_AUTO_REPLY_CHAIN_LIMIT: u32 = 4;

#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub body: String,
    pub reply_to_id: Option<Uuid>,
    #[serde(default)]
    pub mentions: Vec<Uuid>,
    pub idempotency_key: String,
    /// 兼容旧客户端，服务端忽略此字段并以认证主体决定消息类型。
    #[serde(default)]
    pub auto_reply: bool,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct MessageOut {
    pub id: Uuid,
    pub seq: i64,
    pub sender_user_id: Uuid,
    pub sender_agent_instance_id: Option<Uuid>,
    pub reply_to_id: Option<Uuid>,
    pub mentions: Value,
    pub body: String,
    pub auto_reply: bool,
    pub created_at: DateTime<Utc>,
}

pub async fn send_message(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
    Json(req): Json<SendMessageRequest>,
) -> AppResult<Json<MessageOut>> {
    if req.body.trim().is_empty() {
        return Err(AppError::BadRequest("消息内容不能为空".to_string()));
    }
    if req.idempotency_key.trim().is_empty() {
        return Err(AppError::BadRequest("idempotency_key 不能为空".to_string()));
    }
    principal.require_room(&state.pool, room_id).await?;

    let mut tx = state.pool.begin().await?;
    // Serialize checks and insertion in this room, including concurrent rate-limit requests.
    sqlx::query("SELECT room_id FROM room_counters WHERE room_id = $1 FOR UPDATE")
        .bind(room_id)
        .execute(&mut *tx)
        .await?;
    if let Some(parent) = req.reply_to_id {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM messages WHERE id = $1 AND room_id = $2)",
        )
        .bind(parent)
        .bind(room_id)
        .fetch_one(&mut *tx)
        .await?;
        if !exists {
            return Err(AppError::BadRequest("reply_to_id 必须属于当前房间".into()));
        }
    }
    // 幂等检查：相同房间 + 相同幂等键已经处理过，直接返回原结果，不重新写入。
    if let Some(existing) = fetch_by_idempotency(&mut tx, room_id, &req.idempotency_key).await? {
        if existing.sender_user_id != principal.user_id
            || existing.sender_agent_instance_id != principal.agent_instance_id
            || existing.body != req.body
            || existing.reply_to_id != req.reply_to_id
            || existing.mentions != json!(req.mentions)
        {
            return Err(AppError::Conflict("幂等键已被其他消息使用"));
        }
        return Ok(Json(existing));
    }

    // Agent 不能通过自报 auto_reply=false 绕过授权与限流。
    let auto_reply = principal.agent_instance_id.is_some();
    if auto_reply {
        let agent_instance_id = principal.agent_instance_id.unwrap();
        check_auto_reply_enabled(&mut tx, agent_instance_id).await?;
        let reply_to_id = req.reply_to_id.ok_or_else(|| {
            AppError::BadRequest("自动回复必须带 reply_to_id：只响应明确提及/回复".to_string())
        })?;
        check_not_replying_to_self(&mut tx, reply_to_id, agent_instance_id).await?;
        check_rate_limit(&mut tx, agent_instance_id).await?;
        check_chain_limit(&mut tx, reply_to_id).await?;
    }

    let seq = next_seq(&mut tx, room_id).await?;
    let mentions_json = serde_json::to_value(&req.mentions).unwrap_or(json!([]));
    let row: MessageOut = sqlx::query_as(
        r#"
        INSERT INTO messages (room_id, seq, sender_user_id, sender_agent_instance_id, reply_to_id, mentions, body, idempotency_key, auto_reply)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, seq, sender_user_id, sender_agent_instance_id, reply_to_id, mentions, body, auto_reply, created_at
        "#,
    )
    .bind(room_id)
    .bind(seq)
    .bind(principal.user_id)
    .bind(principal.agent_instance_id)
    .bind(req.reply_to_id)
    .bind(&mentions_json)
    .bind(&req.body)
    .bind(&req.idempotency_key)
    .bind(auto_reply)
    .fetch_one(&mut *tx)
    .await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id,
            seq,
            event_type: "message",
            entity_type: Some("message"),
            entity_id: Some(row.id),
            payload: json!({
                "senderUserId": principal.user_id,
                "senderAgentInstanceId": principal.agent_instance_id,
                "mentions": req.mentions,
                "autoReply": auto_reply,
            }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

async fn check_auto_reply_enabled(
    pool: &mut PgConnection,
    agent_instance_id: Uuid,
) -> AppResult<()> {
    let row: Option<(bool,)> = sqlx::query_as(
        "SELECT auto_reply_enabled FROM agent_instances WHERE id = $1 AND revoked_at IS NULL",
    )
    .bind(agent_instance_id)
    .fetch_optional(&mut *pool)
    .await?;
    match row {
        Some((true,)) => Ok(()),
        Some((false,)) => Err(AppError::Forbidden("该 Agent 未开启自动发言")),
        None => Err(AppError::Unauthenticated),
    }
}

async fn check_not_replying_to_self(
    pool: &mut PgConnection,
    reply_to_id: Uuid,
    agent_instance_id: Uuid,
) -> AppResult<()> {
    let row: Option<(Option<Uuid>,)> =
        sqlx::query_as("SELECT sender_agent_instance_id FROM messages WHERE id = $1")
            .bind(reply_to_id)
            .fetch_optional(&mut *pool)
            .await?;
    let row = row.ok_or(AppError::NotFound("reply_to_id 指向的消息不存在"))?;
    if row.0 == Some(agent_instance_id) {
        return Err(AppError::Forbidden("不能自动回复自己刚刚发的消息"));
    }
    Ok(())
}

async fn check_rate_limit(pool: &mut PgConnection, agent_instance_id: Uuid) -> AppResult<()> {
    let row: (i64,) = sqlx::query_as(
        r#"
        SELECT count(*) FROM messages
        WHERE sender_agent_instance_id = $1 AND auto_reply = true
          AND created_at > now() - interval '1 minute'
        "#,
    )
    .bind(agent_instance_id)
    .fetch_one(pool)
    .await?;
    if row.0 >= AGENT_AUTO_REPLY_RATE_LIMIT {
        return Err(AppError::Conflict(
            "该 Agent 已达到每分钟最多 6 条自动回复的限制，请稍后再试",
        ));
    }
    Ok(())
}

/// 从被回复的消息往回数：连续多少条都是自动回复。达到上限就拒绝新的自动回复，
/// 必须等人类在这条链里发一条消息打断（文档 7.2：「再等待人继续」）。
async fn check_chain_limit(pool: &mut PgConnection, reply_to_id: Uuid) -> AppResult<()> {
    let mut current = Some(reply_to_id);
    let mut consecutive_auto = 0u32;
    while let Some(id) = current {
        let row: Option<(bool, Option<Uuid>)> =
            sqlx::query_as("SELECT auto_reply, reply_to_id FROM messages WHERE id = $1")
                .bind(id)
                .fetch_optional(&mut *pool)
                .await?;
        let Some((is_auto, parent)) = row else { break };
        if !is_auto {
            break;
        }
        consecutive_auto += 1;
        if consecutive_auto >= AGENT_AUTO_REPLY_CHAIN_LIMIT {
            return Err(AppError::Conflict(
                "这条因果链已经连续 4 次自动回复，需要等待人工继续",
            ));
        }
        current = parent;
    }
    Ok(())
}

async fn fetch_by_idempotency(
    pool: &mut PgConnection,
    room_id: Uuid,
    idempotency_key: &str,
) -> AppResult<Option<MessageOut>> {
    let row: Option<MessageOut> = sqlx::query_as(
        r#"
        SELECT id, seq, sender_user_id, sender_agent_instance_id, reply_to_id, mentions, body, auto_reply, created_at
        FROM messages WHERE room_id = $1 AND idempotency_key = $2
        "#,
    )
    .bind(room_id)
    .bind(idempotency_key)
    .fetch_optional(&mut *pool)
    .await?;
    Ok(row)
}

#[derive(Deserialize)]
pub struct ListMessagesQuery {
    #[serde(default)]
    pub after_seq: i64,
    pub limit: Option<i64>,
}

pub async fn list_messages(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
    Query(q): Query<ListMessagesQuery>,
) -> AppResult<Json<Vec<MessageOut>>> {
    principal.require_room(&state.pool, room_id).await?;
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let rows: Vec<MessageOut> = sqlx::query_as(
        r#"
        SELECT id, seq, sender_user_id, sender_agent_instance_id, reply_to_id, mentions, body, auto_reply, created_at
        FROM messages
        WHERE room_id = $1 AND seq > $2
        ORDER BY seq ASC
        LIMIT $3
        "#,
    )
    .bind(room_id)
    .bind(q.after_seq)
    .bind(limit)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}
