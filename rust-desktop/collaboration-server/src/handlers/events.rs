//! 房间事件恢复读取：断线后从最后确认序号补拉（设计文档 7.3）。
//! 第一版只提供轮询读取接口；WSS 实时推送留给后续阶段，不影响正确性
//! （文档 4.1：推送只是及时通知，数据库事件记录才是恢复来源）。

use axum::{
    extract::{Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{auth::Principal, error::AppResult, state::AppState};

#[derive(Serialize, sqlx::FromRow)]
pub struct EventOut {
    pub id: Uuid,
    pub seq: i64,
    pub event_type: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub payload: Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct ListEventsQuery {
    #[serde(default)]
    pub after_seq: i64,
    pub limit: Option<i64>,
}

pub async fn list_events(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
    Query(q): Query<ListEventsQuery>,
) -> AppResult<Json<Vec<EventOut>>> {
    principal.require_room(&state.pool, room_id).await?;
    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let rows: Vec<EventOut> = sqlx::query_as(
        r#"
        SELECT id, seq, event_type, entity_type, entity_id, payload, created_at
        FROM room_events
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
