//! MCP 工具定义：原有 10 个动作，加成果读取与 Run 状态查询。
//!
//! 这一层只做「把 MCP 调用翻译成 `CollabClient` 方法调用」，不自己判断任何权限
//! ——能不能做由协作服务端决定，这里只负责把结果（或服务端的拒绝理由）老实
//! 转述给调用方。故意没有实现 `review_task`：验收是人的界面操作，设计文档明确
//! 第一版不开放 Agent 自主验收自己的产出。

use std::future::Future;

use rmcp::{
    handler::server::{router::tool::ToolRouter, tool::Parameters},
    model::{CallToolResult, Content, ServerCapabilities, ServerInfo},
    schemars, tool, tool_handler, tool_router, ErrorData as McpError, ServerHandler,
};
use serde::Deserialize;
use serde_json::Value;

use crate::client::CollabClient;

fn ok_json(value: Value) -> Result<CallToolResult, McpError> {
    let text = serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string());
    Ok(CallToolResult::success(vec![Content::text(text)]))
}

fn to_mcp_err(err: anyhow::Error) -> McpError {
    // 服务端的拒绝理由（权限不足、超限、状态冲突……）原样带回给调用方，不吞掉
    // 细节——Agent 需要知道具体是哪条规则拦住了它，才能决定下一步怎么办。
    McpError::internal_error(err.to_string(), None)
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct AgentBindParams {
    #[schemars(description = "房间成员生成的一次性绑定码，30 分钟内有效，用过即失效")]
    pub bind_code: String,
    #[schemars(description = "宿主类型：codex / dsh / workbuddy / aiwork / ide / other")]
    pub host_kind: String,
    #[schemars(description = "给这个 Agent 实例起的名字，方便房间里的人区分")]
    pub label: String,
    #[schemars(
        description = "可选：这个 Agent 支持的能力，JSON 对象，例如 {\"canUseRoomTools\":true,\"canStartSession\":true}"
    )]
    pub capabilities: Option<Value>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct RoomReadParams {
    #[schemars(description = "从这个序号之后开始读；不填则自动续读上次 room_ack 的位置")]
    pub after_seq: Option<i64>,
    #[schemars(description = "最多返回多少条，默认 50，上限 200")]
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct RoomAckParams {
    #[schemars(description = "把这个 Agent 自己的处理游标推进到这个序号（只会前进不会后退）")]
    pub seq: i64,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct RoomSendParams {
    #[schemars(description = "消息正文")]
    pub body: String,
    #[schemars(description = "回复哪条消息的 id；自动回复必须填这个字段")]
    pub reply_to_id: Option<String>,
    #[schemars(description = "要 @ 的用户 id 列表")]
    pub mentions: Option<Vec<String>>,
    #[schemars(description = "幂等键：同一个键重复调用只会产生一条消息，不会重复发送")]
    pub idempotency_key: String,
    #[schemars(description = "兼容字段，服务端忽略此值；所有 Agent 发言都受授权与限流约束")]
    pub auto_reply: Option<bool>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ContextGetParams {}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct TaskListParams {
    #[schemars(description = "可选：按状态过滤，例如 pending / claimed / in_progress")]
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct TaskClaimParams {
    #[schemars(description = "要领取的任务 id")]
    pub task_id: String,
    #[schemars(description = "任务当前的 version，用于乐观并发；版本不对会被拒绝")]
    pub expected_version: i32,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct TaskStartParams {
    #[schemars(description = "任务 id")]
    pub task_id: String,
    #[schemars(description = "幂等键：同一个键重复调用返回同一个 Run，不会开出第二个")]
    pub idempotency_key: String,
    #[schemars(
        description = "\"auto\"（本机调度器自动调用，需要持有匹配 Grant）或 \"user_triggered\"（人在实际开始工作前的显式动作）"
    )]
    pub execution_mode: String,
    #[schemars(
        description = "user_triggered 必填：负责人通过人类会话签发的一次性任务许可；Agent 无权自行签发"
    )]
    pub authorization_token: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct TaskUpdateParams {
    #[schemars(description = "要更新的 Run id")]
    pub run_id: String,
    #[schemars(description = "\"progress\" | \"blocked\" | \"failed\" | \"cancelled\"")]
    pub kind: String,
    #[schemars(description = "可选的说明文字")]
    pub note: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ArtifactSubmitParams {
    #[schemars(description = "任务 id")]
    pub task_id: String,
    #[schemars(description = "产出这个成果的 Run id")]
    pub run_id: String,
    #[schemars(description = "成果类型，例如 text / markdown / json / log / diff")]
    pub kind: String,
    #[schemars(description = "成果正文，≤10 MiB，不接受可执行文件或压缩包内容")]
    pub content: String,
    #[schemars(description = "怎么验证这个成果是对的（跑了什么检查、看到了什么结果）")]
    pub verification_summary: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ArtifactReadParams {
    pub task_id: String,
    pub artifact_id: Option<String>,
}
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct RunGetParams {
    pub run_id: String,
}

#[derive(Clone)]
pub struct CollabMcp {
    client: CollabClient,
    tool_router: ToolRouter<Self>,
}

impl CollabMcp {
    pub fn new(client: CollabClient) -> Self {
        Self {
            client,
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_router]
impl CollabMcp {
    #[tool(
        description = "用房间成员给的一次性绑定码完成首次连接握手。只做身份确认，\
            不代表任何执行授权——真正能不能自动接单由房间里的 Grant 决定。",
        annotations(
            title = "绑定 Agent 身份",
            read_only_hint = false,
            idempotent_hint = true
        )
    )]
    async fn agent_bind(
        &self,
        Parameters(p): Parameters<AgentBindParams>,
    ) -> Result<CallToolResult, McpError> {
        let result = self
            .client
            .agent_bind(&p.bind_code, &p.host_kind, &p.label, p.capabilities)
            .await
            .map_err(to_mcp_err)?;
        ok_json(result)
    }

    #[tool(
        description = "读取房间消息（按序号递增返回）。不传 after_seq 时自动从上次 \
            room_ack 的位置续读。",
        annotations(title = "读取房间消息", read_only_hint = true, idempotent_hint = true)
    )]
    async fn room_read(
        &self,
        Parameters(p): Parameters<RoomReadParams>,
    ) -> Result<CallToolResult, McpError> {
        let result = self
            .client
            .room_read(p.after_seq, p.limit)
            .await
            .map_err(to_mcp_err)?;
        ok_json(result)
    }

    #[tool(
        description = "把这个 Agent 自己的处理游标推进到某个序号。只影响这个 Agent \
            下次 room_read 的起点，不代表人类已读，也不影响任务完成判定。",
        annotations(
            title = "确认已处理到某条消息",
            read_only_hint = false,
            idempotent_hint = true
        )
    )]
    async fn room_ack(
        &self,
        Parameters(p): Parameters<RoomAckParams>,
    ) -> Result<CallToolResult, McpError> {
        let result = self.client.room_ack(p.seq).await.map_err(to_mcp_err)?;
        ok_json(result)
    }

    #[tool(
        description = "在房间里发一条消息。所有 Agent 发言都会被服务端按限额校验\
            （每分钟最多 6 条、同一因果链最多连续 4 次自动回复、必须带 reply_to_id、\
            不能回复自己刚发的消息），超限会被拒绝而不是静默丢弃。",
        annotations(title = "发送房间消息", read_only_hint = false, idempotent_hint = true)
    )]
    async fn room_send(
        &self,
        Parameters(p): Parameters<RoomSendParams>,
    ) -> Result<CallToolResult, McpError> {
        let result = self
            .client
            .room_send(
                &p.body,
                p.reply_to_id.as_deref(),
                p.mentions,
                &p.idempotency_key,
                p.auto_reply,
            )
            .await
            .map_err(to_mcp_err)?;
        ok_json(result)
    }

    #[tool(
        description = "读取房间的项目背景（目标、约束、术语等），版本化内容。",
        annotations(title = "读取项目背景", read_only_hint = true, idempotent_hint = true)
    )]
    async fn context_get(
        &self,
        Parameters(_p): Parameters<ContextGetParams>,
    ) -> Result<CallToolResult, McpError> {
        let result = self.client.context_get().await.map_err(to_mcp_err)?;
        ok_json(result)
    }

    #[tool(
        description = "列出房间里的任务，可选按状态过滤。",
        annotations(title = "列出任务", read_only_hint = true, idempotent_hint = true)
    )]
    async fn task_list(
        &self,
        Parameters(p): Parameters<TaskListParams>,
    ) -> Result<CallToolResult, McpError> {
        let result = self
            .client
            .task_list(p.status.as_deref())
            .await
            .map_err(to_mcp_err)?;
        ok_json(result)
    }

    #[tool(
        description = "原子领取一个任务：只改变负责人，不会开始执行，也不会跳过\
            乐观并发检查（expected_version 不对会被拒绝）。",
        annotations(title = "领取任务", read_only_hint = false, idempotent_hint = false)
    )]
    async fn task_claim(
        &self,
        Parameters(p): Parameters<TaskClaimParams>,
    ) -> Result<CallToolResult, McpError> {
        let result = self
            .client
            .task_claim(&p.task_id, p.expected_version)
            .await
            .map_err(to_mcp_err)?;
        ok_json(result)
    }

    #[tool(
        description = "启动一轮执行。execution_mode=\"auto\" 必须持有 Agent 令牌并\
            命中一条匹配的有效 Grant，否则会被服务端拒绝；\"user_triggered\" 是人在\
            实际开始工作前由负责人签发的一次性许可，必须传 authorization_token。同一 idempotency_key 重复调用\
            返回同一个 Run，不会重复启动。",
        annotations(title = "启动执行", read_only_hint = false, idempotent_hint = true)
    )]
    async fn task_start(
        &self,
        Parameters(p): Parameters<TaskStartParams>,
    ) -> Result<CallToolResult, McpError> {
        let result = self
            .client
            .task_start(
                &p.task_id,
                &p.idempotency_key,
                &p.execution_mode,
                p.authorization_token.as_deref(),
            )
            .await
            .map_err(to_mcp_err)?;
        ok_json(result)
    }

    #[tool(
        description = "上报执行进度 / 阻塞 / 失败。",
        annotations(
            title = "更新执行状态",
            read_only_hint = false,
            idempotent_hint = false
        )
    )]
    async fn task_update(
        &self,
        Parameters(p): Parameters<TaskUpdateParams>,
    ) -> Result<CallToolResult, McpError> {
        let result = self
            .client
            .task_update(&p.run_id, &p.kind, p.note.as_deref())
            .await
            .map_err(to_mcp_err)?;
        ok_json(result)
    }

    #[tool(
        description = "读取指定成果正文；不传 artifact_id 列出任务成果元数据（最多 50 条）。",
        annotations(read_only_hint = true)
    )]
    async fn artifact_read(
        &self,
        Parameters(p): Parameters<ArtifactReadParams>,
    ) -> Result<CallToolResult, McpError> {
        ok_json(
            self.client
                .artifact_read(&p.task_id, p.artifact_id.as_deref())
                .await
                .map_err(to_mcp_err)?,
        )
    }

    #[tool(
        description = "查询执行状态及租约截止时间；unknown 需要人类确认宿主停止后解决。",
        annotations(read_only_hint = true)
    )]
    async fn run_get(
        &self,
        Parameters(p): Parameters<RunGetParams>,
    ) -> Result<CallToolResult, McpError> {
        ok_json(self.client.run_get(&p.run_id).await.map_err(to_mcp_err)?)
    }

    #[tool(
        description = "提交一个文本类成果（text/markdown/json/log/diff，≤10 MiB，\
            不接受可执行文件或压缩包）。不会自动验收——验收是人的界面操作。",
        annotations(title = "提交成果", read_only_hint = false, idempotent_hint = false)
    )]
    async fn artifact_submit(
        &self,
        Parameters(p): Parameters<ArtifactSubmitParams>,
    ) -> Result<CallToolResult, McpError> {
        let result = self
            .client
            .artifact_submit(
                &p.task_id,
                &p.run_id,
                &p.kind,
                &p.content,
                &p.verification_summary,
            )
            .await
            .map_err(to_mcp_err)?;
        ok_json(result)
    }
}

#[tool_handler]
impl ServerHandler for CollabMcp {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some(
                "EM Use 多人协作房间的瘦客户端：把绑定码换成身份，然后读/发房间消息、\
                 领取并启动任务、上报进度、提交成果。所有权限判断都在服务端——\
                 这里只是老实转述服务端的结果或拒绝理由。"
                    .into(),
            ),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            ..Default::default()
        }
    }
}
