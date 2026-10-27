//! 统一错误类型与 HTTP 映射。
//!
//! 设计依据 docs/agent-collaboration-v1-design.md 第 7.2 节：
//! 服务端拒绝越权访问必须是真实的数据层拒绝，不能只在前端隐藏按钮；
//! 因此这里把「未认证 / 无权限 / 版本冲突 / 冲突状态」拆成明确的错误变体，
//! 而不是一股脑返回 500。

use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("unauthenticated")]
    Unauthenticated,
    #[error("forbidden: {0}")]
    Forbidden(&'static str),
    #[error("not found: {0}")]
    NotFound(&'static str),
    #[error("invalid request: {0}")]
    BadRequest(String),
    #[error("conflict: {0}")]
    Conflict(&'static str),
    #[error("version mismatch: expected {expected}, found {found}")]
    VersionConflict { expected: i32, found: i32 },
    #[error("database error")]
    Database(#[from] sqlx::Error),
    #[error("internal error")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, code, message) = match &self {
            AppError::Unauthenticated => (
                StatusCode::UNAUTHORIZED,
                "unauthenticated",
                self.to_string(),
            ),
            AppError::Forbidden(_) => (StatusCode::FORBIDDEN, "forbidden", self.to_string()),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "not_found", self.to_string()),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request", self.to_string()),
            AppError::Conflict(_) => (StatusCode::CONFLICT, "conflict", self.to_string()),
            AppError::VersionConflict { .. } => {
                (StatusCode::CONFLICT, "version_conflict", self.to_string())
            }
            AppError::Database(err) => {
                tracing::error!(error = %err, "database error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal",
                    "internal error".to_string(),
                )
            }
            AppError::Internal(err) => {
                tracing::error!(error = %err, "internal error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal",
                    "internal error".to_string(),
                )
            }
        };
        (status, Json(json!({ "error": code, "message": message }))).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
