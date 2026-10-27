# EM Use 协作服务

对应 [多人 Agent 协作设计](../docs/agent-collaboration-v1-design.md)。目前实现服务端核心与自研 MCP/CLI 接入，仍属于阶段 B/C 的子集；桌宠 UI、宿主执行适配、跨机器部署尚未完成。

## 已实现

- 邀请注册、会话与设备撤销、Argon2 密码哈希、令牌哈希存储；首次管理员创建串行化。
- 房间、成员、消息、版本化背景、任务、Run、成果与人工验收。
- Agent 绑定、游标、权限范围、自动执行 Grant；消息与业务事件同事务写入。
- 原子接单、幂等启动、单个未解决 Run、成果元数据及正文读取。

### 身份与授权

人类会话和受信任设备可以管理房间、绑定、Grant、自动发言开关及验收。Agent 令牌不能继承这些权限，只能访问绑定房间。禁用用户、移除成员或撤销 Agent 后，该 Agent 认证失效。任务的启动、更新、提交和取消都会重新检查成员资格；同一所有者的不同 Agent 不能操作彼此启动的 Run。

`auto` 启动需要匹配房间、任务发布者、权限等级、有效期的 Grant。自动执行的进度更新和成果提交也检查 Grant，撤销后不能继续提交有效结果。

Agent 的 `user_triggered` 启动需要负责人通过人类会话签发的一次性许可：

1. 领取任务，获取当前 `version`。
2. 人类调用 `POST /v1/tasks/:task_id/authorize`，传 `agent_instance_id`、`expected_version`。
3. 返回的 `authorization_token` 有效期 15 分钟，限定 Agent、任务和版本，只在启动事务成功时消费。
4. Agent 调用 `POST /v1/tasks/:task_id/start`，传该许可、`execution_mode: "user_triggered"` 和稳定的 `idempotency_key`。

人类本人以会话/设备令牌开始自己负责的任务时不需要这个中间许可。许可只授权协作记录中的执行尝试，不能代替宿主沙箱，也不证明宿主进程已经启动。

所有 Agent 消息都属于自动发言；`auto_reply=false` 不构成豁免。默认关闭，开启后必须回复本房间的一条非自身消息，每分钟最多 6 条，每条链最多连续 4 次 Agent 回复。并发请求在同一事务内检查限额及幂等键，不能并发突破。人类直接发言应使用人类会话/设备令牌。

### Run 租约与取消

- 自动模式租约为 90 秒，人工触发模式为 15 分钟；`progress` 按原模式续约。返回值包含 `lease_expires_at`。
- 服务主进程每 15 秒扫描过期 Run；执行写接口和 Run 查询也检查过期。过期进入 `unknown`，任务变为 `blocked`，不会自动重派。
- `POST /v1/runs/:id/cancel` 将运行中的 Run 改为 `cancelling`，保留 90 秒确认窗口。重复取消不延长窗口。
- `cancelling` 不接受进度、失败或成功成果；原执行主体只能以 `update {"kind":"cancelled"}` 报告已停止。这个状态仍是执行主体上报，并非服务端观测到宿主进程退出。
- 未确认取消到期进入 `unknown`。人类核实宿主已停止后调用 `POST /v1/runs/:id/resolve`，传 `confirmed_stopped: true`、`outcome: "failed" | "cancelled"` 和非空 `note`。服务端记录操作者和依据；选择 `failed` 后可显式启动新代次。
- 过期、取消或已结束 Run 的成果提交返回 409，不会改变任务。设计中的“迟到成果独立归档待核对”尚未实现，需在宿主保留原结果。

### 成果接口

| 接口 | 行为 |
|---|---|
| `POST /v1/tasks/:id/artifact` | 提交文本类成果，正文最多 10 MiB，须附验证说明；有效 Run 转待验收 |
| `GET /v1/tasks/:id/artifact?limit=50&after_id=UUID` | 按 UUID 升序分页返回元数据，最多 100 条，不含正文 |
| `GET /v1/tasks/:id/artifact/:artifact_id` | 返回正文、哈希、验证说明；检查任务和房间归属 |
| `POST /v1/tasks/:id/review` | 仅发布者或管理员的人类身份可验收；指定成果必须属于本任务最新成功 Run |
| `GET /v1/runs/:id` | 查询执行状态、来源和租约；受房间权限约束 |

成果不会自动完成任务。验收退回后需要新 Run，旧成果不能代替新一轮的验收对象。

## 运行与升级

```sh
createdb em_use_collab_dev
cd rust-desktop/collaboration-server
DATABASE_URL=postgres://localhost/em_use_collab_dev cargo run
```

默认监听 `127.0.0.1:8787`，`GET /healthz` 返回 `ok`。首次空库调用 `/v1/auth/bootstrap` 创建管理员，之后由管理员生成邀请。服务端 HTTP 监听适合本机开发或置于 TLS 反向代理后；客户端仅允许回环地址使用明文 HTTP。

启动时自动运行新增迁移 `0004_execution_authorizations.sql`，不改旧迁移。已有 `unknown` 与其他未解决 Run 并存的异常数据会使新增唯一索引失败，需要先核对旧运行再迁移，不能自动把未知运行标成停止。

升级接入层需同时按 [MCP/CLI 配置说明](../collaboration-mcp/README.md) 更换独立 profile，并撤销旧版共享文件中的 Agent 令牌。旧 Agent 直接声明 `user_triggered` 将收到 403，这是有意收紧的接口行为。

## 验证

```sh
createdb em_use_collab_test_local
cd rust-desktop/collaboration-server
EM_USE_TEST_DATABASE_URL=postgres://localhost/em_use_collab_test_local cargo test
cargo clippy --all-targets -- -D warnings
```

测试会清空指定库，仅接受显式 `EM_USE_TEST_DATABASE_URL` 且数据库名以 `em_use_collab_test_` 开头；同一个库不能并行运行多个测试命令。

- `tests/integration.rs`：身份、房间、并发启动、任务版本、验收退回、事件恢复。
- `tests/agents.rs`：绑定、Grant 范围、撤销、发言限额和游标。
- `tests/security_regressions.rs`：Agent 控制面越权、跨房间访问、人工触发许可、同所有者多 Agent 隔离、成员移除后的写入、租约过期、取消确认、成果读取/验收归属、并发限流。

本机 PostgreSQL 和源码测试已覆盖上述路径；2026-10-26 另已用真实 DSH、AiWork 桌面端及 Codex CLI 跑通三个独立 Agent 身份下的消息回复、跨宿主成果读取及人工许可后的任务提交，见接入层 README。桌宠浏览器 UI、Tauri 原生协作界面、Codex 桌面 UI 热加载、其他宿主或跨机器部署未验证；各宿主的每轮调用均人工触发。依赖 sqlx-postgres 0.7.4 的 Rust future-incompatibility 提示属于上游依赖提示。

## 后续边界

仍需真实宿主接入与执行事件、HostBinding/能力探测、本机 IPC、定时在线心跳、WSS、桌宠房间和授权 UI、部署备份恢复、迟到成果归档。当前 capabilities 由客户端自报，在线状态只有上报值，不能据此声称具备自动唤醒或停止宿主的能力。
