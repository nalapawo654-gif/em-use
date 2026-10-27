//! 共用客户端：绑定状态持久化 + 对协作服务端 HTTP 接口的薄封装。
//!
//! MCP（`src/main.rs` / `src/mcp_server.rs`）和 CLI（`src/bin/cli.rs`）都只调用
//! 这里的方法，不各自重复鉴权、状态文件读写或字段拼接逻辑——这是设计文档 6.1
//! 节结尾说的「MCP 和 CLI 是这些工具的两种封装，共用鉴权与数据模型」，这里直接
//! 用同一份代码落实，而不是两份平行实现碰巧语义一致。
//!
//! 这一层本身不包含任何权限判断：谁能不能做什么，完全由协作服务端（
//! `collaboration-server`）决定；这里只是把 HTTP 调用和本机令牌存取封装成好用
//! 的函数。

use std::path::PathBuf;
use std::sync::Arc;

use crate::storage::{self, Binding};
use anyhow::{anyhow, bail, Context, Result};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
pub struct Bound {
    pub agent_instance_id: String,
    pub room_id: String,
    #[serde(skip)]
    pub agent_token: String,
}

#[derive(Clone)]
pub struct CollabClient {
    http: reqwest::Client,
    server_url: String,
    state_path: PathBuf,
    bound: Arc<Mutex<Option<Bound>>>,
    credential_store: String,
}

impl CollabClient {
    /// 每个宿主/房间必须配置独立 profile 或状态路径；绑定固定服务端 origin。
    /// 机密默认进系统凭据库，状态文件仅保存身份与绑定元数据。
    pub fn from_env() -> Result<Self> {
        let server_url = std::env::var("EM_USE_SERVER_URL")
            .context("必须设置环境变量 EM_USE_SERVER_URL，例如 http://127.0.0.1:8787")?;
        let server_url = storage::normalize_server(&server_url)?;
        let state_path = storage::state_path()?;
        let credential_store = storage::credential_store()?;
        Self::new(&server_url, state_path, &credential_store)
    }

    /// Desktop onboarding shares the same binding and credential implementation as MCP/CLI.
    /// Explicit parameters avoid changing process-wide environment in a multi-window app.
    pub fn new(server_url: &str, state_path: PathBuf, credential_store: &str) -> Result<Self> {
        let server_url = storage::normalize_server(server_url)?;
        if credential_store != "keyring" && !(cfg!(unix) && credential_store == "file") {
            bail!("不支持的凭据存储");
        }
        let credential_store = credential_store.to_string();
        let bound = storage::load(&state_path, &server_url, &credential_store)?.map(|b| b.identity);
        Ok(Self {
            http: reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(std::time::Duration::from_secs(30))
                .build()?,
            credential_store,
            server_url: server_url.trim_end_matches('/').to_string(),
            state_path,
            bound: Arc::new(Mutex::new(bound)),
        })
    }

    pub async fn bound(&self) -> Option<Bound> {
        self.bound.lock().await.clone()
    }

    async fn require_bound(&self) -> Result<Bound> {
        self.bound.lock().await.clone().ok_or_else(|| {
            anyhow!("尚未绑定：先调用 agent_bind（或 `em-use-collab-cli bind`）完成一次性绑定")
        })
    }

    async fn request(
        &self,
        method: Method,
        path: &str,
        token: Option<&str>,
        body: Option<Value>,
    ) -> Result<Value> {
        let url = format!("{}{}", self.server_url, path);
        let mut req = self.http.request(method, url);
        if let Some(t) = token {
            req = req.bearer_auth(t);
        }
        if let Some(b) = &body {
            req = req.json(b);
        }
        let resp = req
            .send()
            .await
            .context("请求协作服务端失败（检查 EM_USE_SERVER_URL 和服务端是否在跑）")?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        let value: Value = if text.is_empty() {
            Value::Null
        } else {
            serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
        };
        if !status.is_success() {
            let message = value
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or(text.as_str());
            bail!("服务端返回 {status}：{message}");
        }
        Ok(value)
    }

    // ---- 以下方法一一对应设计文档 6.1 节「对 Agent 的工具」表格 ----

    /// 首次握手只确认身份。相同 profile 仅接受同一绑定请求的重放；
    /// 新绑定码/宿主/名称必须使用独立 profile，不能默默返回旧身份。
    pub async fn agent_bind(
        &self,
        bind_code: &str,
        host_kind: &str,
        label: &str,
        capabilities: Option<Value>,
    ) -> Result<Value> {
        let mut guard = self.bound.lock().await;
        let _file_lock = storage::lock(&self.state_path)?;
        if let Some(existing) =
            storage::load(&self.state_path, &self.server_url, &self.credential_store)?
        {
            if existing.host_kind != host_kind
                || existing.label != label
                || existing.bind_code_hash != storage::digest(bind_code)
            {
                bail!("此 profile 已绑定其他身份；请为新宿主或房间设置不同 EM_USE_PROFILE / EM_USE_STATE_FILE");
            }
            *guard = Some(existing.identity.clone());
            return Ok(
                json!({"already_bound":true,"agent_instance_id":existing.identity.agent_instance_id,"room_id":existing.identity.room_id}),
            );
        }
        let body = json!({
            "bind_code": bind_code,
            "host_kind": host_kind,
            "label": label,
            "capabilities": capabilities.unwrap_or_else(|| json!({})),
        });
        let resp = self
            .request(Method::POST, "/v1/agents/bind", None, Some(body))
            .await?;
        let agent_instance_id = resp["agent_instance_id"]
            .as_str()
            .ok_or_else(|| anyhow!("服务端响应缺少 agent_instance_id"))?
            .to_string();
        let room_id = resp["room_id"]
            .as_str()
            .ok_or_else(|| anyhow!("服务端响应缺少 room_id"))?
            .to_string();
        let agent_token = resp["agent_token"]
            .as_str()
            .ok_or_else(|| anyhow!("服务端响应缺少 agent_token"))?
            .to_string();
        let bound = Bound {
            agent_instance_id: agent_instance_id.clone(),
            room_id: room_id.clone(),
            agent_token,
        };
        storage::save(
            &self.state_path,
            &Binding {
                server_url: self.server_url.clone(),
                host_kind: host_kind.into(),
                label: label.into(),
                bind_code_hash: storage::digest(bind_code),
                credential_store: self.credential_store.clone(),
                identity: bound.clone(),
            },
        )?;
        let token = bound.agent_token.clone();
        *guard = Some(bound);
        // 绑定后立即上报一次在线状态，房间成员马上能看到「已连接」，不用等下一次
        // 心跳；失败也不影响绑定结果，这只是锦上添花。
        let _ = self
            .request(
                Method::POST,
                &format!("/v1/agents/{agent_instance_id}/heartbeat"),
                Some(&token),
                Some(json!({"status": "connected"})),
            )
            .await;
        Ok(json!({"agent_instance_id": agent_instance_id, "room_id": room_id}))
    }

    /// 读取房间消息；不传 `after_seq` 时自动从这个 Agent 自己的游标（`room_ack`
    /// 推进过的位置）续读，配合 `room_ack` 就不需要在宿主侧另外记录进度。
    pub async fn room_read(&self, after_seq: Option<i64>, limit: Option<i64>) -> Result<Value> {
        let bound = self.require_bound().await?;
        let after = match after_seq {
            Some(v) => v,
            None => {
                let self_info = self
                    .request(
                        Method::GET,
                        &format!("/v1/agents/{}", bound.agent_instance_id),
                        Some(&bound.agent_token),
                        None,
                    )
                    .await?;
                self_info["acked_seq"].as_i64().unwrap_or(0)
            }
        };
        let mut path = format!("/v1/rooms/{}/messages?after_seq={after}", bound.room_id);
        if let Some(l) = limit {
            path.push_str(&format!("&limit={l}"));
        }
        self.request(Method::GET, &path, Some(&bound.agent_token), None)
            .await
    }

    /// 只推进这个 Agent 自己的处理位置，不代表人类已读、也不影响任务完成判定
    /// （文档 7.3：「设备收到 / Agent 已处理 / 人已读 / 任务完成是四种不同事实」）。
    pub async fn room_ack(&self, seq: i64) -> Result<Value> {
        let bound = self.require_bound().await?;
        self.request(
            Method::POST,
            &format!("/v1/agents/{}/ack", bound.agent_instance_id),
            Some(&bound.agent_token),
            Some(json!({"seq": seq})),
        )
        .await
    }

    pub async fn room_send(
        &self,
        body: &str,
        reply_to_id: Option<&str>,
        mentions: Option<Vec<String>>,
        idempotency_key: &str,
        auto_reply: Option<bool>,
    ) -> Result<Value> {
        let bound = self.require_bound().await?;
        let payload = json!({
            "body": body,
            "reply_to_id": reply_to_id,
            "mentions": mentions.unwrap_or_default(),
            "idempotency_key": idempotency_key,
            "auto_reply": auto_reply.unwrap_or(false),
        });
        self.request(
            Method::POST,
            &format!("/v1/rooms/{}/messages", bound.room_id),
            Some(&bound.agent_token),
            Some(payload),
        )
        .await
    }

    pub async fn context_get(&self) -> Result<Value> {
        let bound = self.require_bound().await?;
        self.request(
            Method::GET,
            &format!("/v1/rooms/{}/context", bound.room_id),
            Some(&bound.agent_token),
            None,
        )
        .await
    }

    pub async fn task_list(&self, status: Option<&str>) -> Result<Value> {
        let bound = self.require_bound().await?;
        let mut path = format!("/v1/rooms/{}/tasks", bound.room_id);
        if let Some(s) = status {
            path.push_str(&format!("?status={s}"));
        }
        self.request(Method::GET, &path, Some(&bound.agent_token), None)
            .await
    }

    pub async fn task_claim(&self, task_id: &str, expected_version: i32) -> Result<Value> {
        let bound = self.require_bound().await?;
        self.request(
            Method::POST,
            &format!("/v1/tasks/{task_id}/claim"),
            Some(&bound.agent_token),
            Some(json!({"expected_version": expected_version})),
        )
        .await
    }

    /// auto 需要匹配 Grant；user_triggered 需要人类签发的一次性任务许可。
    pub async fn task_start(
        &self,
        task_id: &str,
        idempotency_key: &str,
        execution_mode: &str,
        authorization_token: Option<&str>,
    ) -> Result<Value> {
        let bound = self.require_bound().await?;
        self.request(
            Method::POST,
            &format!("/v1/tasks/{task_id}/start"),
            Some(&bound.agent_token),
            Some(json!({
                "idempotency_key": idempotency_key,
                "execution_mode": execution_mode,
                "authorization_token": authorization_token,
            })),
        )
        .await
    }

    pub async fn task_update(&self, run_id: &str, kind: &str, note: Option<&str>) -> Result<Value> {
        let bound = self.require_bound().await?;
        self.request(
            Method::POST,
            &format!("/v1/runs/{run_id}/update"),
            Some(&bound.agent_token),
            Some(json!({"kind": kind, "note": note})),
        )
        .await
    }

    pub async fn artifact_read(&self, task_id: &str, artifact_id: Option<&str>) -> Result<Value> {
        let bound = self.require_bound().await?;
        let path = match artifact_id {
            Some(id) => format!("/v1/tasks/{task_id}/artifact/{id}"),
            None => format!("/v1/tasks/{task_id}/artifact"),
        };
        self.request(Method::GET, &path, Some(&bound.agent_token), None)
            .await
    }

    pub async fn run_get(&self, run_id: &str) -> Result<Value> {
        let bound = self.require_bound().await?;
        self.request(
            Method::GET,
            &format!("/v1/runs/{run_id}"),
            Some(&bound.agent_token),
            None,
        )
        .await
    }

    pub async fn artifact_submit(
        &self,
        task_id: &str,
        run_id: &str,
        kind: &str,
        content: &str,
        verification_summary: &str,
    ) -> Result<Value> {
        let bound = self.require_bound().await?;
        self.request(
            Method::POST,
            &format!("/v1/tasks/{task_id}/artifact"),
            Some(&bound.agent_token),
            Some(json!({
                "run_id": run_id,
                "kind": kind,
                "content": content,
                "verification_summary": verification_summary,
            })),
        )
        .await
    }
}
