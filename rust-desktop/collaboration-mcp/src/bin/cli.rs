//! 轻量 CLI：和 `em-use-collab-mcp` 共用同一个 `CollabClient`
//! （`em_use_collab_mcp::client`），给不支持 MCP 的宿主（或人手工调试）用同一套
//! 鉴权与数据模型。子命令和参数基本是 MCP 工具的直接映射。

use clap::{Parser, Subcommand};
use em_use_collab_mcp::client::CollabClient;
use serde_json::Value;

#[derive(Parser)]
#[command(
    name = "em-use-collab-cli",
    about = "EM Use 协作房间的轻量 CLI（MCP 工具的同等命令行封装）"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// 用一次性绑定码完成首次连接握手
    Bind {
        bind_code: String,
        host_kind: String,
        label: String,
        /// 可选：JSON 格式的能力声明，例如 '{"canUseRoomTools":true}'
        #[arg(long)]
        capabilities: Option<String>,
    },
    /// 读取房间消息（不传 --after-seq 则自动从上次 ack 的位置续读）
    RoomRead {
        #[arg(long)]
        after_seq: Option<i64>,
        #[arg(long)]
        limit: Option<i64>,
    },
    /// 推进这个 Agent 自己的处理游标
    RoomAck { seq: i64 },
    /// 发一条房间消息
    RoomSend {
        body: String,
        #[arg(long)]
        idempotency_key: String,
        #[arg(long)]
        reply_to_id: Option<String>,
        #[arg(long)]
        mention: Vec<String>,
        /// 兼容字段；所有 Agent 发言均受授权、频率和链长限制
        #[arg(long)]
        auto_reply: bool,
    },
    /// 读取房间的项目背景
    ContextGet,
    /// 列出房间任务
    TaskList {
        #[arg(long)]
        status: Option<String>,
    },
    /// 领取任务
    TaskClaim {
        task_id: String,
        #[arg(long)]
        expected_version: i32,
    },
    /// 启动执行（execution_mode: auto | user_triggered）
    TaskStart {
        task_id: String,
        #[arg(long)]
        idempotency_key: String,
        #[arg(long, default_value = "user_triggered")]
        execution_mode: String,
    },
    /// 上报进度 / 阻塞 / 失败
    TaskUpdate {
        run_id: String,
        /// progress | blocked | failed | cancelled
        kind: String,
        #[arg(long)]
        note: Option<String>,
    },
    /// 查询 Run 状态和租约
    RunGet { run_id: String },
    /// 读取成果；省略 artifact-id 列出元数据
    ArtifactRead {
        task_id: String,
        #[arg(long)]
        artifact_id: Option<String>,
    },
    /// 提交成果
    ArtifactSubmit {
        task_id: String,
        run_id: String,
        kind: String,
        content: String,
        #[arg(long)]
        verification_summary: String,
    },
}

fn print_json(value: Value) {
    println!(
        "{}",
        serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string())
    );
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let client = CollabClient::from_env()?;

    let result = match cli.command {
        Command::Bind {
            bind_code,
            host_kind,
            label,
            capabilities,
        } => {
            let caps = capabilities
                .map(|s| serde_json::from_str::<Value>(&s))
                .transpose()
                .map_err(|e| anyhow::anyhow!("--capabilities 不是合法 JSON: {e}"))?;
            client
                .agent_bind(&bind_code, &host_kind, &label, caps)
                .await
        }
        Command::RoomRead { after_seq, limit } => client.room_read(after_seq, limit).await,
        Command::RoomAck { seq } => client.room_ack(seq).await,
        Command::RoomSend {
            body,
            idempotency_key,
            reply_to_id,
            mention,
            auto_reply,
        } => {
            let mentions = if mention.is_empty() {
                None
            } else {
                Some(mention)
            };
            client
                .room_send(
                    &body,
                    reply_to_id.as_deref(),
                    mentions,
                    &idempotency_key,
                    Some(auto_reply),
                )
                .await
        }
        Command::ContextGet => client.context_get().await,
        Command::TaskList { status } => client.task_list(status.as_deref()).await,
        Command::TaskClaim {
            task_id,
            expected_version,
        } => client.task_claim(&task_id, expected_version).await,
        Command::TaskStart {
            task_id,
            idempotency_key,
            execution_mode,
        } => {
            client
                .task_start(
                    &task_id,
                    &idempotency_key,
                    &execution_mode,
                    std::env::var("EM_USE_TASK_AUTHORIZATION").ok().as_deref(),
                )
                .await
        }
        Command::TaskUpdate { run_id, kind, note } => {
            client.task_update(&run_id, &kind, note.as_deref()).await
        }
        Command::RunGet { run_id } => client.run_get(&run_id).await,
        Command::ArtifactRead {
            task_id,
            artifact_id,
        } => client.artifact_read(&task_id, artifact_id.as_deref()).await,
        Command::ArtifactSubmit {
            task_id,
            run_id,
            kind,
            content,
            verification_summary,
        } => {
            client
                .artifact_submit(&task_id, &run_id, &kind, &content, &verification_summary)
                .await
        }
    };

    match result {
        Ok(value) => {
            print_json(value);
            Ok(())
        }
        Err(err) => {
            eprintln!("错误: {err}");
            std::process::exit(1);
        }
    }
}
