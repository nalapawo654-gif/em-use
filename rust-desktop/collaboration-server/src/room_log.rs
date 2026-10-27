//! 房间内严格递增序号分配与事件追加。
//!
//! 对应设计文档 4.1 / 6.3：业务变更与待推送事件在同一事务提交；
//! 本骨架版本只实现「数据库事件记录作为恢复来源」，尚未实现 WSS 实时推送
//! （文档明确推送只是及时通知，不是数据正确性的来源，因此延后不影响正确性）。

use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn next_seq(
    tx: &mut Transaction<'_, Postgres>,
    room_id: Uuid,
) -> Result<i64, sqlx::Error> {
    let row: (i64,) =
        sqlx::query_as("SELECT next_seq FROM room_counters WHERE room_id = $1 FOR UPDATE")
            .bind(room_id)
            .fetch_one(&mut **tx)
            .await?;
    sqlx::query("UPDATE room_counters SET next_seq = next_seq + 1 WHERE room_id = $1")
        .bind(room_id)
        .execute(&mut **tx)
        .await?;
    Ok(row.0)
}

pub struct NewEvent<'a> {
    pub room_id: Uuid,
    pub seq: i64,
    pub event_type: &'a str,
    pub entity_type: Option<&'a str>,
    pub entity_id: Option<Uuid>,
    pub payload: Value,
}

pub async fn append_event(
    tx: &mut Transaction<'_, Postgres>,
    event: NewEvent<'_>,
) -> Result<Uuid, sqlx::Error> {
    let row: (Uuid,) = sqlx::query_as(
        r#"
        INSERT INTO room_events (room_id, seq, event_type, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
    )
    .bind(event.room_id)
    .bind(event.seq)
    .bind(event.event_type)
    .bind(event.entity_type)
    .bind(event.entity_id)
    .bind(event.payload)
    .fetch_one(&mut **tx)
    .await?;
    Ok(row.0)
}
