# 项目协作桌面入口 · 第一版

2026-10-27 更新。基于现有协作服务与 MCP，提供 Tauri 项目窗口、原生接入向导和随包 MCP。原设计见 [多 Agent 协作设计](agent-collaboration-v1-design.md)。

## 已实现的使用流程

1. 从桌宠「设置 → 项目协作」或托盘「项目协作」打开独立窗口。重复打开会聚焦已有窗口。
2. 填写自建服务地址，登录独立协作账户。空服务可创建首个管理员；管理员在项目成员面板生成注册邀请，再按用户名添加成员。
3. 创建或选择项目。项目拥有固定房间 ID、成员、背景版本、消息、Agent 和任务。窗口关闭后服务端内容保留；桌面端按服务与用户恢复最近项目。
4. 在项目内「接入 Agent」登记宿主及配置范围，创建独立身份和状态文件，再复制生成的宿主配置。接入不会覆盖现有宿主文件。
5. 在对应宿主手动调用 `room_read`，核对房间 ID，再在 Agent 详情允许房间回复。此开关只允许服务端接收消息，不唤醒宿主。
6. 创建带完成条件的任务。Agent 领取后，由负责人在任务详情签发单次执行许可，将指令交给指定 Agent。成果回来后可查看正文、哈希、Run 状态，人工验收或退回。

本版任务表单设置 `read_only` 和 `room_tools_only`。这是任务声明与服务端授权边界；本产品尚未接管宿主执行器，不能以此声称限制了宿主的本地文件或命令权限。那些权限仍由宿主沙箱控制。

## 接入范围

| 宿主 | 生成配置 | 实际隔离范围与限制 |
| --- | --- | --- |
| Codex | TOML `mcp_servers.em_use` | 项目配置；全局配置会被多个会话共享，登记会话 ID 不等于强制会话隔离。CLI 之前已真实联调，桌面配置加载仍需验证。 |
| DeepSeek Harness | `cordis.patch.yml` 的 MCP client 插件配置 | 强制登记独立 profile；desktop profile 被其中多个会话共享，不能靠改会话名实现隔离。 |
| AiWork | `.opencode/opencode.json` 的 `mcp.em_use` | 对应会话目录；针对已联调版本生成，保留原文件内容，重新加载后核验。 |
| WorkBuddy / IDE / 其他 | 通用 stdio `mcpServers` JSON | 配置模板，不宣称该宿主已验证；字段及加载范围需按实际宿主确认。 |

每个绑定使用独立 `AgentInstance`、`EM_USE_STATE_FILE` 和钥匙串凭据。同一服务、用户、宿主、会话/profile 标识不能直接绑定第二个项目；需使用独立配置范围，或明确撤销后重新接入。该标识是本机登记，不会扫描、接管或核验外部宿主窗口。

凭据检测只验证「本机身份能访问对应房间」。界面不会把这种检测当成宿主在线证据；心跳过期后显示「在线状态待确认」。已有服务端 Agent 仍能在项目中显示，未由本机向导登记的身份显示「该身份未在当前设备登记」。

## 服务端与桌宠端改动

- 服务端新增 `GET /v1/auth/me`，恢复会话时校验当前有效身份，只返回用户资料。其余房间、任务、成果、邀请、授权使用现有接口，无新增数据库迁移。
- 原生端新增专用 `collaboration` IPC 与独立 capability。只接受本地协作窗口；代理操作限定接口路径。人类会话令牌留在系统钥匙串，不送入页面。
- 原生端通过随包 MCP 的 `--desktop-command` 完成绑定和探测，仍复用 `CollabClient` 与存储模块。绑定码经 stdin 传递，进程参数和输出不含令牌；子进程超时退出，不回退明文。Agent 凭据由同一 MCP 可执行程序创建和读取，避免 macOS 把桌宠写入、MCP 读取当成跨程序钥匙串访问。人类会话仍由桌宠管理。
- 桌面配置 `collaboration.json` 保存服务地址、最近项目及非敏感绑定元数据；配置损坏时拒绝覆盖。绑定文件放在应用数据目录的 `collaboration/profiles/<uuid>/binding.json`。
- Vue 新增独立 `collaboration.html`，从共享设置、托盘进入，不改动桌宠手势或账户额度服务。桌面最低窗口为 760×560。
- 当前每 5 秒增量读取，窗口不可见或操作/读取进行中不追加轮询。请求结果校验项目与会话代次；旧项目迟到的响应不能覆盖新项目。消息重试沿用幂等键，发送响应不会推进读取游标。
- 草稿按项目隔离，仅在当前窗口内存保存。登出清除页面内容和草稿；项目历史以服务端为准。浏览器预览仅在内存保存登录令牌，刷新后重新登录，最近项目可以恢复。
- 成果作为纯文本展示，不执行成果中的 HTML/脚本。单次执行许可、注册邀请码仅在弹窗显示，关闭清除；复制到剪贴板的内容由用户自行管理。

## 本地运行

需要 PostgreSQL、Rust 和 Node。先按 [服务端说明](../collaboration-server/README.md) 启动服务并迁移数据库，再运行：

```bash
cd rust-desktop
npm run desktop
# 构建发行包（会先编译对应目标的 release MCP）
npm run tauri -- build
```

`beforeDevCommand` / `beforeBuildCommand` 自动运行 `mcp:prepare`，按目标架构构建 MCP，再通过 Tauri `bundle.externalBin` 随应用安装。macOS 位于 `.app/Contents/MacOS/em-use-collab-mcp`，Windows 位于主程序同目录。原生向导优先使用随包路径，不再要求用户单独编译 MCP；找不到程序时才显示人工指定入口。

交叉编译可显式设置 `EM_USE_MCP_TARGET`；CI 为 macOS arm64 / Windows x64 设置对应 target。`verify-collaboration-bundle.mjs` 检查二进制架构、可执行性及 `--version` 启动；macOS App 和挂载的 DMG 验证都包含 MCP。Windows 当前检查构建目录中的 sidecar，尚未做安装后实机验收。

配置引用应用安装位置。移动或重命名 `.app` 后，既有宿主中的绝对路径需要更新；签名升级后的钥匙串授权连续性尚需发行版本验证。接入向导生成配置并登记对应关系，本版不自动合并外部宿主配置文件。

生产服务使用 HTTPS origin（不带路径、查询、账户）；仅本机回环地址允许 HTTP。升级桌面客户端时需同步升级服务端，以支持 `/v1/auth/me`。

浏览器预览使用：

```bash
cd rust-desktop
VITE_COLLABORATION_DEV_SERVER=http://127.0.0.1:8798 npm run dev
```

访问 `http://127.0.0.1:5174/collaboration.html`。该开发变量只配置本地开发代理的固定目标，不是任意 URL 代理。浏览器不提供本机 Agent 绑定与钥匙串操作。

## 2026-10-26 浏览器阶段记录

证据目录：`output/collaboration-desktop-2026-10-26/`；完整前端测试日志：`output/collaboration-desktop-tests-2026-10-26.log`。

| 层面 | 本轮结果 |
| --- | --- |
| 前端源码 | `npm run build` 通过；Vue 类型检查与契约生成通过。原主入口仍有大分块构建提示。 |
| 前端测试 | 239 项 TypeScript 测试、12 项脚本测试通过，含新增 8 项协作状态/隔离测试；最终小改后协作测试复跑通过。 |
| 原生源码 | macOS `cargo check` 通过；新增 2 项来源/绑定隔离测试通过。 |
| 服务端 | 隔离测试数据库运行全部 4 项集成测试通过，包括新增会话恢复、Agent 拒绝及登出后失效。 |
| MCP | 2 项单元测试及 1 项真实 MCP/CLI 子进程往返集成测试通过。 |
| 浏览器 + 真实 API | 隔离数据库 `em_use_collab_test_ui_20261026`、服务 8798：登录、建项目、消息、背景、任务、读取成果、人工验收、项目切换草稿隔离、刷新重新登录后项目恢复通过；760×560 无水平溢出。 |
| 原生桌面实机 | 本轮未运行新原生窗口的钥匙串登录/接入闭环；不等同于编译通过。 |
| 真实宿主 | 本轮浏览器的三种 Agent 是明确标注的 API 测试身份；未重新驱动三个真实宿主。此前联调证据保留在 MCP README，不能替代本轮原生接入验收。 |
| 整体资源校验 | `verify:parity` 未通过，发现工作区原有 4 个未登记 PNG：`evolution/v2/hermit.png`、`evolution/v3/hermit-transformation.png`、`hermit/normal.png`、`hermit/props.png`；本次协作功能没有新增运行时图片，未修改这些并行工作资产。 |

2026-10-26 阶段未打包安装，记录保留作历史基线。后续原生验证见下节；旧房间中的成果没有被本轮修改或验收。


## 2026-10-27 原生随包与真实宿主验证

证据：`output/collaboration-native-2026-10-27/verification.json`。隔离服务为本机 `8799`，数据库 `em_use_collab_native_trial_20261027`。独立 QA 应用标识 `com.wantwant123.emuse.collabqa`，未替换正式安装应用。

- **原生窗口**：从桌宠设置打开、登录、创建固定项目、发送人类消息、三种宿主分别登记、生成随包路径配置、钥匙串凭据探测均实测通过。AiWork 的单次执行许可由原生任务窗口签发。
- **随包交付**：macOS arm64 QA `.app`（主程序 debug、MCP release）构建完成，复制到独立安装位置后通过架构、启动、深度签名检查。真实宿主都调用该 `.app` 内的 MCP，没有调用源码目录中的 debug MCP。
- **真实宿主**：DSH 桌面端 14 次、AiWork 桌面端 12 次、Codex 已安装 CLI 13 次 MCP 调用成功。形成 Codex → DSH → AiWork → Codex 的真实回复链，三种 AgentInstance 不同；每种宿主均领取任务、使用单次许可、提交并回读成果。3 个 Run 均 `succeeded`，3 个 Task 均 `pending_review`，成果 SHA-256 回算一致。
- **修复实际失败**：初版由桌宠创建 Agent 凭据，MCP 跨进程读取触发钥匙串提示并连接超时；已改成 MCP 自己创建/读取。失败的 3 个身份已撤销，修正后重新通过原生窗口创建并完成上述实测。
- **原生重启**：测试应用重启先卡在既有额度账户的 `account::restore → storage::credentials → SecKeychainFindGenericPassword`，采样已保存。用户处理系统安全窗口后，已实测无需重新登录恢复协作账户、最近项目、三个绑定及消息任务；原生窗口可读取真实成果正文、哈希、Run 终态。该结果与无需人工介入的冷启动分开记录，未修改额度账户桥接。
- **源码与测试**：前端 239 项 TypeScript + 13 项脚本测试通过；MCP 2 项单元测试及 1 项真实子进程集成测试通过，新增桌面命令绑定后 MCP 恢复身份、错误身份拒绝、输出不泄露绑定码的覆盖。原生 2 项来源/绑定隔离测试最终复跑通过，日志单独保存。

DSH 验证的是共享 desktop profile，AiWork 为独立会话目录；Codex 验证的是 CLI `exec/resume`，为兼容桌面配置中的专用 transport，隔离加载本次 MCP 并保留用户模型设置，全局配置哈希未变。此结果不等同于 Codex 桌面/IDE 自动加载项目配置已通过。Codex 官方配置说明见 [MCP 文档](https://developers.openai.com/codex/extend/mcp)。

未验证：Windows 安装后运行、发行 DMG/公证、跨机器/多人部署、宿主强制停止、自动唤醒/接力、本地代码编辑，以及升级签名后的凭据连续性。未发布、提交或推送。

本轮 `verify:parity` 仍未通过：未登记运行时图片 evolution/v2/hermit.png, evolution/v3/hermit-transformation.png, hermit/normal.png, hermit/props.png。这是现有并行桌宠资产，本次未改动；因此整体 CI 发布前仍需对应资产工作完成登记。
