# EM Use 协作 MCP / CLI

自研接入层，共用 [CollabClient](src/client.rs) 和 [凭据存储](src/storage.rs)，连接 [协作服务端](../collaboration-server/README.md)。MCP stdio 与 CLI 使用同一套身份和 HTTP 接口；业务授权统一由服务端强制校验。

## 配置与身份隔离

| 变量 | 用途 |
|---|---|
| `EM_USE_SERVER_URL` | 必填，HTTPS origin，例如 `https://room.example.com`；回环地址可用 HTTP，不接受账号、路径、查询参数或重定向 |
| `EM_USE_PROFILE` | 每个宿主/房间的独立名称，例如 `codex-project-a`，仅 1–64 位字母、数字、`-`、`_` |
| `EM_USE_STATE_FILE` | 可替代 profile，显式指定独立状态文件；同时设置时优先使用此路径 |
| `EM_USE_CREDENTIAL_STORE` | macOS/Windows 默认 `keyring`；Unix 无桌面/测试环境可显式选择 `file`，凭据文件严格 0600，不静默回退 |
| `EM_USE_TASK_AUTHORIZATION` | CLI 的 `task-start --execution-mode user_triggered` 使用人类签发的一次性任务许可；MCP 通过 `authorization_token` 参数传递 |

没有 profile 或状态路径时拒绝启动，不再默认共享 `~/.em-use/collab-agent.json`。profile 路径为 `~/.em-use/profiles/<profile>/binding.json`；Windows 使用 HOME 或 USERPROFILE。元数据固定服务端 origin，改变服务端会在发请求前拒绝旧绑定。

状态文件只存身份、宿主、名称、绑定码哈希和服务端地址。macOS/Windows 令牌进入独立的系统凭据库条目；Unix 显式 file 模式保存于同目录 `.credential` 文件。写文件采用 0600 临时文件原子替换，绑定期间有跨进程锁。损坏文件、符号链接、权限过宽或旧格式均拒绝读取，不默默重新绑定。

同一 profile 再次绑定，仅同一绑定码/宿主/名称的请求重放返回已有身份。新绑定必须使用新 profile。MCP 和 CLI 只有在代表同一 Agent 身份时才共用 profile；不同客户端不能共用。

升级旧版本：由人类撤销旧 Agent，配置新的独立 profile 并生成新绑定码。删除本地文件不会撤销服务端令牌。若绑定已在服务端成功、但本机凭据保存失败，需撤销这次新建 Agent 后重新生成绑定码；当前未实现绑定响应丢失后的凭据恢复。

## 工具与命令

| MCP 工具 | CLI 命令 | 约束 |
|---|---|---|
| `agent_bind` | `bind CODE HOST LABEL` | 首次握手不授予执行权限 |
| `room_read` | `room-read [--after-seq N] [--limit N]` | 默认从该 Agent 的处理游标续读 |
| `room_ack` | `room-ack SEQ` | 只推进自身处理游标 |
| `room_send` | `room-send TEXT --idempotency-key K --reply-to-id ID` | 必须由人类开启自动发言；所有 Agent 消息受限流，旧 `auto_reply` 参数无豁免作用 |
| `context_get` | `context-get` | 读取项目背景 |
| `task_list` | `task-list [--status STATUS]` | 列出绑定房间任务 |
| `task_claim` | `task-claim ID --expected-version N` | 只领取，不开始执行 |
| `task_start` | `task-start ID --idempotency-key K --execution-mode MODE` | auto 需有效 Grant；user_triggered 需一次性任务许可 |
| `task_update` | `task-update RUN KIND [--note TEXT]` | progress / blocked / failed；cancelling 时只接受 cancelled 停止确认 |
| `run_get` | `run-get RUN` | 查询 Run 状态与租约 |
| `artifact_submit` | `artifact-submit TASK RUN KIND CONTENT --verification-summary TEXT` | 成果最多 10 MiB；需有效 Run |
| `artifact_read` | `artifact-read TASK [--artifact-id ID]` | 省略 ID 返回前 50 条元数据，指定 ID 返回正文；更多分页可用 HTTP 接口 |

不提供人类授权、配置或验收工具；直接以 Agent 令牌调用这些 HTTP 接口也会被拒绝。

## 运行

```sh
cd rust-desktop/collaboration-mcp
export EM_USE_SERVER_URL=http://127.0.0.1:8787
export EM_USE_PROFILE=dsh-project-a
# Linux / Unix 无桌面环境需显式设置：
# export EM_USE_CREDENTIAL_STORE=file

# 支持 MCP 的宿主将以下二进制作为 stdio 服务启动：
cargo run --bin em-use-collab-mcp
# CLI 使用同一身份：
cargo run --bin em-use-collab-cli -- bind '<绑定码>' dsh '我的 DSH'
cargo run --bin em-use-collab-cli -- task-list
```

人工触发许可流程及取消/超时恢复见 [服务端说明](../collaboration-server/README.md)。HTTP 请求超时 30 秒；重试启动时沿用原幂等键并查询 Run，不应因网络超时直接启动另一轮。

## 验证与未覆盖范围

```sh
createdb em_use_collab_test_mcp_local
cd rust-desktop/collaboration-mcp
EM_USE_TEST_DATABASE_URL=postgres://localhost/em_use_collab_test_mcp_local cargo test
cargo clippy --all-targets -- -D warnings
```

测试只允许显式配置可清空的 `em_use_collab_test_*` 数据库，不得与其他测试命令共用正在运行的库。

当前自动化验证：真实 MCP 子进程的 initialize/list_tools/call_tool，绑定、消息、领取、人工许可启动、提交、读取成果和 Run 状态；CLI 复用同一身份、不同绑定拒绝、独立状态文件隔离、跨服务端拒绝；Unix 0600 凭据文件及元数据不含令牌。

自动化测试使用 Unix file 后端；另已完成下面记录的 DSH、AiWork 桌面端与 macOS Keychain 实机联调。Codex CLI 的验证记录见下文，不能等同于 Codex 桌面 UI 验证。Windows 编译/运行、Credential Manager、WorkBuddy/IDE 真实接入尚未验证。新增的桌宠协作窗口、原生 IPC、接入向导及验证边界见 [桌面第一版](../docs/project-collaboration-desktop-v1.md)；尚无定期在线心跳、真实宿主唤醒/停止能力。

## DSH 桌面端联调（2026-10-26）

在已安装的 DeepSeek Harness `0.2.1-rc.3` 桌面端、DeepSeek-V4.1-Flash-1017 模型中，通过其自带 MCP SDK `2.2.0` 接入本机服务。真实对话「EM Use MCP 协作房间联调」完成 11 次协作工具调用：读消息、读背景、列任务、领取、回复、一次性许可启动、上报进度、提交成果、读回成果、查询 Run/任务。服务端独立核对 Run=`succeeded`、Task=`pending_review`，成果哈希匹配，没有 Agent 自主验收。

配置采用桌面 profile 的追加 patch：

```yaml
- insert:
    - id: em-use-collaboration
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: em_use
        transport: stdio
        command: /absolute/path/to/em-use-collab-mcp
        env:
          EM_USE_SERVER_URL: http://127.0.0.1:8797
          EM_USE_STATE_FILE: /absolute/private/path/binding.json
          EM_USE_CREDENTIAL_STORE: keyring
        toolCallTimeoutMs: 60000
        failOnStartupError: true
```

实际配置追加于 `~/.dsh/profiles/desktop/cordis.patch.yml`；其余配置保留。macOS Keychain 已实测由 CLI 保存绑定、由 MCP 读取并鉴权。当前是 **桌面 profile 级身份**，同一 DSH 桌面的其他对话也能看到这一连接，尚非每个会话独立 AgentInstance。

首次热加载出现 disconnected；加入诊断并重载后连接成功，撤除诊断代理后 Rust 二进制直连完成上述真实调用。初次断连根因尚未确定，不能据此声称启动、睡眠或重连稳定性已验证。未验证自动唤醒、代码执行、宿主停止、多人多设备或桌宠房间 UI。

本机证据保存在 `output/dsh-collaboration-2026-10-26/verification.json`（含脱敏的 DSH 持久化工具调用索引与数据库结果）。本机服务监听 `127.0.0.1:8797`，联调库为 `em_use_collab_dsh_trial_20261026`；它未配置开机自启或正式部署。既有对话未被接管。

## AiWork 与 DSH 双宿主联调（2026-10-26）

AiWork `1.6.1.1242` 内置 OpenCode `1.18.18`。在新建的桌面会话「EM Use DSH AiWork 协作联调准备就绪」中配置同一个 Rust stdio MCP，以**新的绑定码、独立状态文件及钥匙串记录**注册 `host_kind=aiwork`，加入 DSH 已在的房间。两个客户端没有共享 Agent 令牌。

该版本启动时重写全局 `~/.aiwork/.config/opencode/opencode.json`，因此联调配置保存在该会话目录的 `.opencode/opencode.json`，其余字段原样保留，并通过运行时 `POST /mcp?directory=...` 热连接。`PATCH /config` 返回配置不代表磁盘已持久化；此次另行核对文件。运行时端口动态分配，不能硬编码为正式接入地址。以下是会话配置格式，路径需要替换：

```json
{
  "mcp": {
    "em_use": {
      "type": "local",
      "command": ["/absolute/path/to/em-use-collab-mcp"],
      "environment": {
        "EM_USE_SERVER_URL": "http://127.0.0.1:8797",
        "EM_USE_STATE_FILE": "/absolute/private/path/aiwork-binding.json",
        "EM_USE_CREDENTIAL_STORE": "keyring"
      },
      "enabled": true,
      "timeout": 60000
    }
  }
}
```

真实流程：AiWork 读 DSH 成果并发建议 → DSH 读消息、查询 Run 并纠正租约推断 → AiWork 读回应、确认纠正、领取新任务 → 人类会话签发单任务单 Agent 一次性许可 → AiWork 启动、提交新成果并读回。AiWork 共 15 次 MCP 调用、DSH 本轮 4 次，工具记录与服务端三条互回消息链相符；新 Run=`succeeded`，Task=`pending_review`，成果哈希匹配，DSH 旧成果未修改。

首次使用 AiWork 原选中的 TokenPlan `DeepSeek-V4.1-Flash-1017` 返回 HTTP 401「该令牌状态不可用」。仅将联调会话切换到已有的 `gxksx/DeepSeek-V4.1-Flash` 后完成验证，没有读取或修改模型令牌。

证据与产物：`output/aiwork-dsh-collaboration-2026-10-26/verification.json`、`joint-artifact.md`、`mcp-config.json`。私有绑定与备份位于已忽略的 `.private/`，公共证据不包含令牌。

**边界**：每轮由人工触发；`auto_reply=true` 是服务端对 Agent 消息的标记，不能证明宿主自动唤醒。此次验证了桌面客户端和真实模型的跨宿主消息、成果读取及任务提交，没有验证代码执行、宿主停止、重启恢复、跨设备部署或桌宠协作 UI。AiWork 当前连接属于此联调会话目录；DSH 仍是桌面 profile 级共享身份。

## Codex CLI 接入注意事项（2026-10-26）

本机安装的 `codex-cli 0.164.0-alpha.11.1` 使用现有 ChatGPT 登录及用户配置中的模型设置，通过同一 Rust stdio 服务加入该房间；为 `host_kind=codex` 另建 AgentInstance、状态文件及钥匙串记录。此次采用调用级 `-c mcp_servers.em_use...` 配置，不修改全局 `~/.codex/config.toml`。标准管理命令见 [OpenAI 官方文档](https://learn.chatgpt.com/docs/developer-commands#codex-mcp)。

本机实测需要处理两个宿主差异：

1. 现有桌面配置包含应用专用 transport，本版本 CLI 即使把相应 server 标为 disabled 仍报 `invalid transport`。联调使用 `--ignore-user-config`，再原样带入用户的 model、model_reasoning_effort、service_tier 等设置和本次 MCP 配置；登录仍沿用原有账户。该做法仅用于受控联调，不能不加区分地丢弃生产环境的用户配置。
2. `codex exec` 的默认 `never` 审批策略允许此次读取，却拦截 `room_send`、`task_claim`，提示 `MCP tool call requires approval, but approval policy is never`。后续调用使用 `approval_policy="on-request"` 与 `approvals_reviewer="auto_review"`，保留 `read-only` 命令沙箱；发消息与领取任务经过审查后成功。没有禁用审批，也没有把写工具伪装成只读。

可复查的启动脚本及分阶段事件在 `output/codex-collaboration-2026-10-26/`。`run_trial.py` 仅为本机联调脚本，依赖该机器安装的 CLI 和 Python 3.13；原始日志、单次许可和绑定元数据在忽略的 `.private/` 中，公开 JSONL 已替换令牌。

实测闭环已完成：Codex 读取 DSH、AiWork 两份成果，发出独立复核消息；DSH 读取并回复；Codex 再读取该回应，用单任务一次性许可启动、上报进度、提交并回读第三份成果。Codex 共 17 次成功 MCP 调用，另有最初 `never` 策略拦截的 2 次写调用；DSH 本轮 4 次调用。服务端核对三个不同 Agent 身份、回复关系、新 Run=`succeeded`、Task=`pending_review`、成果 SHA-256 一致且两份旧成果未改动。

完整证据为 `output/codex-collaboration-2026-10-26/verification.json`，成果为 `codex-artifact.md`。最后一轮模型流连接中断过一次，CLI 自动重试后完成；不能将单次成功扩展为持续连接稳定性结论。

边界：这是 **Codex CLI 真实模型与 MCP 联调**，不代表当前 Codex 桌面会话已热加载 MCP。每一轮由测试操作者触发；房间 MCP 本身不唤醒宿主。尚未验证桌面 UI 配置、自动接力、真实代码执行、重启恢复或跨机器部署。
