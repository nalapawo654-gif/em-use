//! 项目背景：人工维护、保留版本，Agent 可读但不能自行覆盖（设计文档 2.1）。

use axum::{extract::State, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    auth::Principal,
    error::{AppError, AppResult},
    models::require_role,
    room_log::{append_event, next_seq, NewEvent},
    state::AppState,
};

#[derive(Serialize)]
pub struct ContextOut {
    pub version: i32,
    pub body: String,
    pub updated_by: Uuid,
    pub created_at: DateTime<Utc>,
}

pub async fn get_context(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<Option<ContextOut>>> {
    principal.require_room(&state.pool, room_id).await?;
    let row: Option<(i32, String, Uuid, DateTime<Utc>)> = sqlx::query_as(
        r#"
        SELECT version, body, updated_by, created_at
        FROM context_versions
        WHERE room_id = $1
        ORDER BY version DESC
        LIMIT 1
        "#,
    )
    .bind(room_id)
    .fetch_optional(&state.pool)
    .await?;
    Ok(Json(row.map(|(version, body, updated_by, created_at)| {
        ContextOut {
            version,
            body,
            updated_by,
            created_at,
        }
    })))
}

#[derive(Deserialize)]
pub struct UpdateContextRequest {
    pub body: String,
    /// 乐观并发版本号：必须等于当前版本，否则拒绝（避免并发覆盖共同约定）。
    pub expected_version: i32,
}

pub async fn update_context(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
    Json(req): Json<UpdateContextRequest>,
) -> AppResult<Json<ContextOut>> {
    principal.require_human()?;
    let role = principal.require_room(&state.pool, room_id).await?;
    require_role(&role, &["owner", "admin"])?;
    if req.body.trim().is_empty() {
        return Err(AppError::BadRequest("背景内容不能为空".to_string()));
    }

    let mut tx = state.pool.begin().await?;
    let current: (i32,) =
        sqlx::query_as("SELECT current_context_version FROM rooms WHERE id = $1 FOR UPDATE")
            .bind(room_id)
            .fetch_one(&mut *tx)
            .await?;
    if current.0 != req.expected_version {
        return Err(AppError::VersionConflict {
            expected: req.expected_version,
            found: current.0,
        });
    }
    let next_version = current.0 + 1;
    let row: (i32, String, Uuid, DateTime<Utc>) = sqlx::query_as(
        r#"
        INSERT INTO context_versions (room_id, version, body, updated_by)
        VALUES ($1, $2, $3, $4)
        RETURNING version, body, updated_by, created_at
        "#,
    )
    .bind(room_id)
    .bind(next_version)
    .bind(&req.body)
    .bind(principal.user_id)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE rooms SET current_context_version = $1 WHERE id = $2")
        .bind(next_version)
        .bind(room_id)
        .execute(&mut *tx)
        .await?;
    let seq = next_seq(&mut tx, room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id,
            seq,
            event_type: "context_updated",
            entity_type: Some("context_version"),
            entity_id: None,
            payload: json!({ "version": next_version, "updatedBy": principal.user_id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(ContextOut {
        version: row.0,
        body: row.1,
        updated_by: row.2,
        created_at: row.3,
    }))
}
