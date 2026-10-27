//! MCP stdio 服务入口：绑定码换身份之后，把 EM Use 协作房间的几个核心动作
//! （读/发消息、任务领取/启动/更新、提交成果）暴露成 MCP 工具。
//!
//! 这一层本身不包含权限逻辑，只是 `em_use_collab_mcp::client::CollabClient`
//! 的瘦封装——同一套客户端代码也被 `em-use-collab-cli` 二进制复用
//! （设计文档 6.1：「MCP 和 CLI 是这些工具的两种封装，共用鉴权与数据模型」）。

use em_use_collab_mcp::{client::CollabClient, mcp_server::CollabMcp};
use rmcp::{transport::stdio, ServiceExt};
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::Read;

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
enum DesktopCommand {
    Bind {
        bind_code: String,
        host_kind: String,
        label: String,
    },
    Probe {
        agent_id: String,
        room_id: String,
    },
}

// The same signed executable creates and reads its keychain items. Creating them
// in the desktop process instead causes a cross-application keychain prompt.
// One-time bind codes arrive over stdin, never process arguments or output.
async fn desktop_command() -> anyhow::Result<Value> {
    let mut input = String::new();
    std::io::stdin()
        .take(16 * 1024 + 1)
        .read_to_string(&mut input)?;
    anyhow::ensure!(input.len() <= 16 * 1024, "桌面接入请求过大");
    let command: DesktopCommand = serde_json::from_str(&input)?;
    let client = CollabClient::from_env()?;
    match command {
        DesktopCommand::Bind {
            bind_code,
            host_kind,
            label,
        } => {
            client
                .agent_bind(
                    &bind_code,
                    &host_kind,
                    &label,
                    Some(json!({"manual_trigger":true,"automatic_wakeup":false})),
                )
                .await
        }
        DesktopCommand::Probe { agent_id, room_id } => {
            let bound = client
                .bound()
                .await
                .ok_or_else(|| anyhow::anyhow!("本机绑定文件缺失"))?;
            anyhow::ensure!(
                bound.agent_instance_id == agent_id && bound.room_id == room_id,
                "本机身份与项目绑定不一致，请解绑重建"
            );
            client.context_get().await?;
            Ok(json!({"verified":true}))
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if std::env::args().nth(1).as_deref() == Some("--version") {
        println!("em-use-collab-mcp {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    if std::env::args().nth(1).as_deref() == Some("--desktop-command") {
        match desktop_command().await {
            Ok(value) => println!("{}", json!({"result":value})),
            // Keep credentials out of errors even when an upstream response is bad.
            Err(_) => {
                println!(
                    "{}",
                    json!({"error":"MCP 接入失败，请检查服务连接、绑定状态与系统钥匙串；不会回退到明文"})
                );
                std::process::exit(1);
            }
        }
        return Ok(());
    }
    let client = CollabClient::from_env()?;
    let server = CollabMcp::new(client);

    // stdio 是 MCP 的传输通道，不能往 stdout 打印任何日志（会和协议帧混在一起）。
    let service = server.serve(stdio()).await.inspect_err(|e| {
        eprintln!("em-use-collab-mcp 启动失败: {e}");
    })?;
    service.waiting().await?;
    Ok(())
}
