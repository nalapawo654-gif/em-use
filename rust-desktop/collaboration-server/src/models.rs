//! 跨 handler 复用的权限校验与小型查询辅助。

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

#[derive(sqlx::FromRow, Debug, Clone, PartialEq, Eq)]
pub struct MembershipRow {
    pub role: String,
}

/// 校验用户是该房间的在职成员，返回角色；否则拒绝——
/// 这是真实的数据层拒绝，不是前端隐藏按钮（设计文档 7.2 / 11.2 节要求）。
pub async fn require_active_member(
    pool: &PgPool,
    room_id: Uuid,
    user_id: Uuid,
) -> Result<String, AppError> {
    let row: Option<MembershipRow> = sqlx::query_as(
        r#"
        SELECT role FROM memberships
        WHERE room_id = $1 AND user_id = $2 AND status = 'active'
        "#,
    )
    .bind(room_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    row.map(|r| r.role)
        .ok_or(AppError::Forbidden("不是房间成员或已被移除"))
}

pub fn require_role(role: &str, allowed: &[&str]) -> Result<(), AppError> {
    if allowed.contains(&role) {
        Ok(())
    } else {
        Err(AppError::Forbidden("当前角色无权执行该操作"))
    }
}

pub async fn require_active_room(pool: &PgPool, room_id: Uuid) -> Result<(), AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT status FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(pool)
        .await?;
    match row {
        Some((status,)) if status == "active" => Ok(()),
        Some(_) => Err(AppError::Conflict("房间已归档")),
        None => Err(AppError::NotFound("房间不存在")),
    }
}
