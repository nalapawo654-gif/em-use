//! 身份与设备接口：邀请注册、登录、登出、设备配对与撤销。
//!
//! 第一版不提供公开注册（设计文档 8 节）：只有已存在的管理员才能发邀请；
//! 服务首次启动、用户表为空时允许一次 `bootstrap` 创建第一个管理员账户，
//! 之后该接口永久关闭。

use axum::{extract::State, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    auth::{generate_token, hash_password, hash_token, session_expiry, verify_password, Principal},
    error::{AppError, AppResult},
    state::AppState,
};

#[derive(Serialize)]
pub struct UserOut {
    pub id: Uuid,
    pub username: String,
    pub display_name: String,
    pub is_admin: bool,
}

/// Restore a desktop session without returning credentials or trusting cached identity.
pub async fn me(State(state): State<AppState>, principal: Principal) -> AppResult<Json<UserOut>> {
    principal.require_human()?;
    let row: (Uuid, String, String, bool) = sqlx::query_as(
        "SELECT id, username, display_name, is_admin FROM users WHERE id=$1 AND status='active'",
    ).bind(principal.user_id).fetch_one(&state.pool).await?;
    Ok(Json(UserOut { id: row.0, username: row.1, display_name: row.2, is_admin: row.3 }))
}

#[derive(Deserialize)]
pub struct BootstrapRequest {
    pub username: String,
    pub password: String,
    pub display_name: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub user: UserOut,
    pub session_token: String,
    pub expires_at: DateTime<Utc>,
}

pub async fn bootstrap(
    State(state): State<AppState>,
    Json(req): Json<BootstrapRequest>,
) -> AppResult<Json<AuthResponse>> {
    if req.username.trim().is_empty() || req.password.len() < 8 {
        return Err(AppError::BadRequest(
            "用户名不能为空，密码至少 8 位".to_string(),
        ));
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("LOCK TABLE users IN EXCLUSIVE MODE")
        .execute(&mut *tx)
        .await?;
    let count: (i64,) = sqlx::query_as("SELECT count(*) FROM users")
        .fetch_one(&mut *tx)
        .await?;
    if count.0 > 0 {
        return Err(AppError::Conflict(
            "已存在账户，bootstrap 只能在空库时使用一次",
        ));
    }
    let password_hash = hash_password(&req.password).map_err(AppError::Internal)?;
    let user: (Uuid, String, String, bool) = sqlx::query_as(
        r#"
        INSERT INTO users (username, display_name, password_hash, is_admin)
        VALUES ($1, $2, $3, true)
        RETURNING id, username, display_name, is_admin
        "#,
    )
    .bind(&req.username)
    .bind(&req.display_name)
    .bind(&password_hash)
    .fetch_one(&mut *tx)
    .await?;
    let (plain, token_hash) = generate_token("sess");
    let expires_at = session_expiry();
    sqlx::query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(user.0)
        .bind(&token_hash)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(AuthResponse {
        user: UserOut {
            id: user.0,
            username: user.1,
            display_name: user.2,
            is_admin: user.3,
        },
        session_token: plain,
        expires_at,
    }))
}

#[derive(Deserialize)]
pub struct CreateInviteRequest {
    pub note: Option<String>,
    pub ttl_hours: Option<i64>,
}

#[derive(Serialize)]
pub struct InviteOut {
    pub invite_token: String,
    pub expires_at: DateTime<Utc>,
}

pub async fn create_invite(
    State(state): State<AppState>,
    principal: Principal,
    Json(req): Json<CreateInviteRequest>,
) -> AppResult<Json<InviteOut>> {
    principal.require_human()?;
    require_admin(&state, principal.user_id).await?;
    let (plain, token_hash) = generate_token("invite");
    let ttl = req.ttl_hours.unwrap_or(72).clamp(1, 24 * 30);
    let expires_at = Utc::now() + chrono::Duration::hours(ttl);
    sqlx::query(
        r#"
        INSERT INTO invites (token_hash, created_by, note, expires_at)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(&token_hash)
    .bind(principal.user_id)
    .bind(&req.note)
    .bind(expires_at)
    .execute(&state.pool)
    .await?;
    Ok(Json(InviteOut {
        invite_token: plain,
        expires_at,
    }))
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub invite_token: String,
    pub username: String,
    pub password: String,
    pub display_name: String,
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> AppResult<Json<AuthResponse>> {
    if req.username.trim().is_empty() || req.password.len() < 8 {
        return Err(AppError::BadRequest(
            "用户名不能为空，密码至少 8 位".to_string(),
        ));
    }
    let token_hash = hash_token(&req.invite_token);
    let mut tx = state.pool.begin().await?;
    let invite: Option<(Uuid,)> = sqlx::query_as(
        r#"
        SELECT id FROM invites
        WHERE token_hash = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
        FOR UPDATE
        "#,
    )
    .bind(&token_hash)
    .fetch_optional(&mut *tx)
    .await?;
    let invite = invite.ok_or(AppError::Forbidden("邀请不存在、已使用或已过期"))?;

    let password_hash = hash_password(&req.password).map_err(AppError::Internal)?;
    let user: (Uuid, String, String, bool) = sqlx::query_as(
        r#"
        INSERT INTO users (username, display_name, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, username, display_name, is_admin
        "#,
    )
    .bind(&req.username)
    .bind(&req.display_name)
    .bind(&password_hash)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("UPDATE invites SET used_by = $1, used_at = now() WHERE id = $2")
        .bind(user.0)
        .bind(invite.0)
        .execute(&mut *tx)
        .await?;

    let (plain, session_hash) = generate_token("sess");
    let expires_at = session_expiry();
    sqlx::query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(user.0)
        .bind(&session_hash)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(AuthResponse {
        user: UserOut {
            id: user.0,
            username: user.1,
            display_name: user.2,
            is_admin: user.3,
        },
        session_token: plain,
        expires_at,
    }))
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    let row: Option<(Uuid, String, String, bool, String)> = sqlx::query_as(
        r#"
        SELECT id, username, display_name, is_admin, password_hash FROM users
        WHERE username = $1 AND status = 'active'
        "#,
    )
    .bind(&req.username)
    .fetch_optional(&state.pool)
    .await?;
    let row = row.ok_or(AppError::Unauthenticated)?;
    if !verify_password(&req.password, &row.4) {
        return Err(AppError::Unauthenticated);
    }
    let (plain, token_hash) = generate_token("sess");
    let expires_at = session_expiry();
    sqlx::query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(row.0)
        .bind(&token_hash)
        .bind(expires_at)
        .execute(&state.pool)
        .await?;
    Ok(Json(AuthResponse {
        user: UserOut {
            id: row.0,
            username: row.1,
            display_name: row.2,
            is_admin: row.3,
        },
        session_token: plain,
        expires_at,
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    principal: Principal,
) -> AppResult<Json<serde_json::Value>> {
    let Some(hash) = principal.session_token_hash else {
        return Err(AppError::BadRequest(
            "设备令牌不能调用 logout，请使用撤销设备接口".to_string(),
        ));
    };
    sqlx::query(
        "UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
    )
    .bind(&hash)
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct CreateDeviceRequest {
    pub name: String,
}

#[derive(Serialize)]
pub struct DeviceOut {
    pub device_id: Uuid,
    pub device_token: String,
}

pub async fn create_device(
    State(state): State<AppState>,
    principal: Principal,
    Json(req): Json<CreateDeviceRequest>,
) -> AppResult<Json<DeviceOut>> {
    principal.require_human()?;
    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("设备名称不能为空".to_string()));
    }
    let (plain, token_hash) = generate_token("dev");
    let row: (Uuid,) = sqlx::query_as(
        r#"
        INSERT INTO devices (user_id, name, token_hash)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
    )
    .bind(principal.user_id)
    .bind(&req.name)
    .bind(&token_hash)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(DeviceOut {
        device_id: row.0,
        device_token: plain,
    }))
}

pub async fn revoke_device(
    State(state): State<AppState>,
    principal: Principal,
    axum::extract::Path(device_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    principal.require_human()?;
    let result = sqlx::query(
        r#"
        UPDATE devices SET status = 'revoked', revoked_at = now()
        WHERE id = $1 AND user_id = $2 AND status = 'active'
        "#,
    )
    .bind(device_id)
    .bind(principal.user_id)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("设备不存在或不属于当前用户"));
    }
    Ok(Json(json!({ "ok": true })))
}

async fn require_admin(state: &AppState, user_id: Uuid) -> AppResult<()> {
    let row: Option<(bool,)> = sqlx::query_as("SELECT is_admin FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await?;
    match row {
        Some((true,)) => Ok(()),
        Some((false,)) => Err(AppError::Forbidden("需要管理员权限")),
        None => Err(AppError::Unauthenticated),
    }
}
