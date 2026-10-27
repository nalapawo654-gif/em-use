//! EM Use 协作服务 · 第一版骨架启动入口。
//!
//! 范围边界见 rust-desktop/collaboration-server/README.md 与
//! docs/agent-collaboration-v1-design.md：本进程只实现身份/房间/消息/任务/成果，
//! 不包含任何 Agent 执行适配、MCP/CLI、WSS 推送。

use em_use_collaboration_server::{app, db, state::AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/em_use_collab_dev".to_string());
    let bind_addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1:8787".to_string());

    let pool = db::connect(&database_url).await?;
    db::migrate(&pool).await?;
    tracing::info!("connected and migrated");
    let expiry_pool = pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(15));
        loop {
            interval.tick().await;
            if let Err(err) =
                em_use_collaboration_server::handlers::tasks::expire_runs(&expiry_pool).await
            {
                tracing::error!(%err,"lease expiration failed");
            }
        }
    });

    let state = AppState { pool };
    let router = app(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!(%bind_addr, "em-use collaboration server listening");
    axum::serve(listener, router).await?;
    Ok(())
}
