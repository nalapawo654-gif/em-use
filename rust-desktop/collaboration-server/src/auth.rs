//! 身份与设备认证。
//!
//! 第一版不接 SSO，使用邀请注册 + 用户名密码；会话令牌与设备令牌都是
//! 高熵随机值，只在服务端保存 SHA-256 哈希（不是明文、也不是可逆加密）。
//! 密码使用 argon2 加盐哈希。
//!
//! 对应设计文档 8 节「身份与设备」：
//! users / invites / sessions / devices；第一版不提供公开注册，
//! 邀请一次有效、设备可撤销且立即失效。

use argon2::{
    password_hash::{
        rand_core::OsRng as PasswordOsRng, PasswordHasher, PasswordVerifier, SaltString,
    },
    Argon2, PasswordHash,
};
use axum::{extract::FromRequestParts, http::request::Parts};
use chrono::{DateTime, Utc};
use rand::RngCore;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

pub fn hash_password(password: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut PasswordOsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("hash password: {e}"))?;
    Ok(hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

/// 生成一个高熵随机令牌，返回 (明文令牌一次性展示, 存入数据库的哈希)。
/// 明文只在创建响应中返回一次；之后任何接口都不能再读出。
pub fn generate_token(prefix: &str) -> (String, String) {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    let plain = format!("{prefix}_{}", hex::encode(bytes));
    (plain.clone(), hash_token(&plain))
}

pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

/// 人类会话/设备与限于单一房间的 Agent 是不同权限主体。
#[derive(Debug, Clone)]
pub struct Principal {
    pub user_id: Uuid,
    pub device_id: Option<Uuid>,
    pub agent_instance_id: Option<Uuid>,
    pub agent_room_id: Option<Uuid>,
    /// 仅当由 session 令牌发起时存在；logout 用它精确撤销当前这一条会话，
    /// 不会误撤销同一用户在其他设备上的会话。
    pub session_token_hash: Option<String>,
}

#[axum::async_trait]
impl FromRequestParts<AppState> for Principal {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthenticated)?;
        let token = header
            .strip_prefix("Bearer ")
            .ok_or(AppError::Unauthenticated)?;
        resolve_token(&state.pool, token).await
    }
}

#[derive(sqlx::FromRow)]
struct SessionRow {
    user_id: Uuid,
}

#[derive(sqlx::FromRow)]
struct DeviceRow {
    id: Uuid,
    user_id: Uuid,
}

#[derive(sqlx::FromRow)]
struct AgentInstanceRow {
    id: Uuid,
    user_id: Uuid,
    room_id: Uuid,
}

async fn resolve_token(pool: &PgPool, token: &str) -> Result<Principal, AppError> {
    let token_hash = hash_token(token);
    if token.starts_with("sess_") {
        let row: Option<SessionRow> = sqlx::query_as(
            r#"
            SELECT user_id FROM sessions
            WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() AND EXISTS (SELECT 1 FROM users u WHERE u.id = sessions.user_id AND u.status = 'active')
            "#,
        )
        .bind(&token_hash)
        .fetch_optional(pool)
        .await?;
        let row = row.ok_or(AppError::Unauthenticated)?;
        return Ok(Principal {
            user_id: row.user_id,
            device_id: None,
            agent_instance_id: None,
            agent_room_id: None,
            session_token_hash: Some(token_hash),
        });
    }
    if token.starts_with("dev_") {
        let row: Option<DeviceRow> = sqlx::query_as(
            r#"
            SELECT id, user_id FROM devices
            WHERE token_hash = $1 AND status = 'active' AND EXISTS (SELECT 1 FROM users u WHERE u.id = devices.user_id AND u.status = 'active')
            "#,
        )
        .bind(&token_hash)
        .fetch_optional(pool)
        .await?;
        let row = row.ok_or(AppError::Unauthenticated)?;
        return Ok(Principal {
            user_id: row.user_id,
            device_id: Some(row.id),
            agent_instance_id: None,
            agent_room_id: None,
            session_token_hash: None,
        });
    }
    if token.starts_with("agent_") {
        let row: Option<AgentInstanceRow> = sqlx::query_as(
            r#"
            SELECT id, user_id, room_id FROM agent_instances
            WHERE token_hash = $1 AND revoked_at IS NULL
              AND EXISTS (SELECT 1 FROM users u WHERE u.id = agent_instances.user_id AND u.status = 'active')
              AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = agent_instances.user_id AND m.room_id = agent_instances.room_id AND m.status = 'active')
            "#,
        )
        .bind(&token_hash)
        .fetch_optional(pool)
        .await?;
        let row = row.ok_or(AppError::Unauthenticated)?;
        return Ok(Principal {
            user_id: row.user_id,
            device_id: None,
            agent_instance_id: Some(row.id),
            agent_room_id: Some(row.room_id),
            session_token_hash: None,
        });
    }
    Err(AppError::Unauthenticated)
}

/// session 令牌固定有效期（第一版不做刷新令牌，到期需重新登录）。
pub fn session_expiry() -> DateTime<Utc> {
    Utc::now() + chrono::Duration::days(14)
}

impl Principal {
    pub fn require_human(&self) -> Result<(), AppError> {
        if self.agent_instance_id.is_some() {
            return Err(AppError::Forbidden(
                "此操作需要人类会话或受信任设备，Agent 无权代行",
            ));
        }
        Ok(())
    }

    pub async fn require_room_on(
        &self,
        conn: &mut sqlx::PgConnection,
        room_id: Uuid,
    ) -> Result<String, AppError> {
        if self.agent_room_id.is_some_and(|bound| bound != room_id) {
            return Err(AppError::Forbidden("Agent 只能访问绑定房间"));
        }
        let role: Option<String> = sqlx::query_scalar("SELECT m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.room_id=$1 AND m.user_id=$2 AND m.status='active' AND u.status='active'")
            .bind(room_id).bind(self.user_id).fetch_optional(conn).await?;
        role.ok_or(AppError::Forbidden("不是当前房间成员或用户已禁用"))
    }

    pub async fn require_room(&self, pool: &PgPool, room_id: Uuid) -> Result<String, AppError> {
        if self.agent_room_id.is_some_and(|bound| bound != room_id) {
            return Err(AppError::Forbidden("Agent 只能访问绑定房间"));
        }
        crate::models::require_active_member(pool, room_id, self.user_id).await
    }
}
