//! 房间与成员：创建、邀请（直接按用户名加入）、退出、移除、归档。
//!
//! 第一版不做跨组织大厅（设计文档 2.3），一个项目一个主房间；
//! 成员变化作为基础事件写入 room_events，供断线恢复读取（文档 6.3）。

use axum::{extract::State, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    auth::Principal,
    error::{AppError, AppResult},
    models::{require_active_room, require_role},
    room_log::{append_event, next_seq, NewEvent},
    state::AppState,
};

#[derive(Deserialize)]
pub struct CreateRoomRequest {
    pub name: String,
}

#[derive(Serialize)]
pub struct RoomOut {
    pub id: Uuid,
    pub name: String,
    pub status: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

pub async fn create_room(
    State(state): State<AppState>,
    principal: Principal,
    Json(req): Json<CreateRoomRequest>,
) -> AppResult<Json<RoomOut>> {
    principal.require_human()?;
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("房间名不能为空".to_string()));
    }
    let mut tx = state.pool.begin().await?;
    let room: (Uuid, String, String, DateTime<Utc>) = sqlx::query_as(
        r#"
        INSERT INTO rooms (name, created_by) VALUES ($1, $2)
        RETURNING id, name, status, created_at
        "#,
    )
    .bind(&req.name)
    .bind(principal.user_id)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("INSERT INTO room_counters (room_id, next_seq) VALUES ($1, 1)")
        .bind(room.0)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        r#"
        INSERT INTO memberships (room_id, user_id, role) VALUES ($1, $2, 'owner')
        "#,
    )
    .bind(room.0)
    .bind(principal.user_id)
    .execute(&mut *tx)
    .await?;
    let seq = next_seq(&mut tx, room.0).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id: room.0,
            seq,
            event_type: "room_created",
            entity_type: Some("room"),
            entity_id: Some(room.0),
            payload: json!({ "createdBy": principal.user_id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(RoomOut {
        id: room.0,
        name: room.1,
        status: room.2,
        role: "owner".to_string(),
        created_at: room.3,
    }))
}

pub async fn list_rooms(
    State(state): State<AppState>,
    principal: Principal,
) -> AppResult<Json<Vec<RoomOut>>> {
    principal.require_human()?;
    let rows: Vec<(Uuid, String, String, DateTime<Utc>, String)> = sqlx::query_as(
        r#"
        SELECT r.id, r.name, r.status, r.created_at, m.role
        FROM rooms r
        JOIN memberships m ON m.room_id = r.id
        WHERE m.user_id = $1 AND m.status = 'active'
        ORDER BY r.created_at DESC
        "#,
    )
    .bind(principal.user_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(
        rows.into_iter()
            .map(|(id, name, status, created_at, role)| RoomOut {
                id,
                name,
                status,
                role,
                created_at,
            })
            .collect(),
    ))
}

#[derive(Serialize)]
pub struct MemberOut {
    pub user_id: Uuid,
    pub username: String,
    pub display_name: String,
    pub role: String,
}

pub async fn list_members(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<Vec<MemberOut>>> {
    principal.require_room(&state.pool, room_id).await?;
    let rows: Vec<(Uuid, String, String, String)> = sqlx::query_as(
        r#"
        SELECT u.id, u.username, u.display_name, m.role
        FROM memberships m
        JOIN users u ON u.id = m.user_id
        WHERE m.room_id = $1 AND m.status = 'active'
        ORDER BY m.joined_at ASC
        "#,
    )
    .bind(room_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(
        rows.into_iter()
            .map(|(user_id, username, display_name, role)| MemberOut {
                user_id,
                username,
                display_name,
                role,
            })
            .collect(),
    ))
}

#[derive(Deserialize)]
pub struct AddMemberRequest {
    pub username: String,
    pub role: Option<String>,
}

pub async fn add_member(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
    Json(req): Json<AddMemberRequest>,
) -> AppResult<Json<MemberOut>> {
    principal.require_human()?;
    let role = principal.require_room(&state.pool, room_id).await?;
    require_role(&role, &["owner", "admin"])?;
    require_active_room(&state.pool, room_id).await?;
    let new_role = req.role.unwrap_or_else(|| "member".to_string());
    if !["member", "admin"].contains(&new_role.as_str()) {
        return Err(AppError::BadRequest(
            "role 只能是 member 或 admin".to_string(),
        ));
    }
    let target: Option<(Uuid, String, String)> =
        sqlx::query_as("SELECT id, username, display_name FROM users WHERE username = $1")
            .bind(&req.username)
            .fetch_optional(&state.pool)
            .await?;
    let target = target.ok_or(AppError::NotFound("用户不存在"))?;

    let mut tx = state.pool.begin().await?;
    let inserted = sqlx::query(
        r#"
        INSERT INTO memberships (room_id, user_id, role, status)
        VALUES ($1, $2, $3, 'active')
        ON CONFLICT (room_id, user_id)
        DO UPDATE SET status = 'active', role = EXCLUDED.role, removed_at = NULL
        WHERE memberships.status = 'removed'
        "#,
    )
    .bind(room_id)
    .bind(target.0)
    .bind(&new_role)
    .execute(&mut *tx)
    .await?;
    if inserted.rows_affected() == 0 {
        return Err(AppError::Conflict("该用户已是房间成员"));
    }
    let seq = next_seq(&mut tx, room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id,
            seq,
            event_type: "member_joined",
            entity_type: Some("user"),
            entity_id: Some(target.0),
            payload: json!({ "username": target.1, "role": new_role }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(MemberOut {
        user_id: target.0,
        username: target.1,
        display_name: target.2,
        role: new_role,
    }))
}

pub async fn remove_member(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path((room_id, target_user_id)): axum::extract::Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    principal.require_human()?;
    let role = principal.require_room(&state.pool, room_id).await?;
    let is_self = target_user_id == principal.user_id;
    if !is_self {
        require_role(&role, &["owner", "admin"])?;
    }
    let mut tx = state.pool.begin().await?;
    let result = sqlx::query(
        r#"
        UPDATE memberships SET status = 'removed', removed_at = now()
        WHERE room_id = $1 AND user_id = $2 AND status = 'active'
        "#,
    )
    .bind(room_id)
    .bind(target_user_id)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("成员不存在或已移除"));
    }
    let seq = next_seq(&mut tx, room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id,
            seq,
            event_type: if is_self {
                "member_left"
            } else {
                "member_removed"
            },
            entity_type: Some("user"),
            entity_id: Some(target_user_id),
            payload: json!({ "removedBy": principal.user_id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn archive_room(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(room_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    principal.require_human()?;
    let role = principal.require_room(&state.pool, room_id).await?;
    require_role(&role, &["owner"])?;
    let mut tx = state.pool.begin().await?;
    let result = sqlx::query(
        "UPDATE rooms SET status = 'archived', archived_at = now() WHERE id = $1 AND status = 'active'",
    )
    .bind(room_id)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict("房间不存在或已归档"));
    }
    let seq = next_seq(&mut tx, room_id).await?;
    append_event(
        &mut tx,
        NewEvent {
            room_id,
            seq,
            event_type: "room_archived",
            entity_type: Some("room"),
            entity_id: Some(room_id),
            payload: json!({ "archivedBy": principal.user_id }),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "ok": true })))
}
