# Codex 实时额度接入

2026-10-20 · macOS / Windows 原生；不包含 WSL。

## 使用

1. 在本机 Codex 中使用 ChatGPT 账户登录。
2. EM Use → 设置 → 账户与额度 → 连接本机 Codex。
3. 将「桌宠展示的额度来源」切换为 Codex。设置、托盘、所有 13 种桌宠的额度详情都可切换来源。
4. 默认使用 codex 额度分组；接口返回其他分组时可在设置中选择。桌宠同时显示所选分组实际返回的各窗口剩余百分比，例如「5 小时 62%」「周 28%」；仅返回周窗口的账户只显示周额度。以接口实际窗口为准，不按 Pro 等套餐名称隐藏窗口，不补造不存在的额度。返回窗口数值未知时显示 `—`。角色形态仍跟随剩余比例最低的有效窗口；各窗口重置时间保留在悬停提示与额度详情中。
5. 自动发现失败时，在高级设置中指定原生可执行文件绝对路径及 Codex 数据目录。Windows 指定 codex.exe，不执行 .cmd / PowerShell 命令；数据目录默认为 CODEX_HOME 或用户目录的 .codex。

两个来源可以同时连接，切换展示不退出账户，不影响咚咚消息和日程。断开 Codex 监控不会注销 Codex。升级默认保留原 AI 云平台来源，Codex 监控默认关闭。

## 实现与边界

- Rust `codex.rs` 启动 `codex app-server --listen stdio://`，完成 initialize / initialized，依次读取 account/read、account/rateLimits/read、account/read。账户前后不一致则丢弃结果。无 thread/start 或 turn/start，不读取 auth.json、日志库或会话内容。
- 通过 Codex 自身处理认证。仅向前端提供白名单账户展示字段、额度分组、窗口和同步时间；不转发凭据、标准错误或任意 RPC 错误正文。
- 发现 macOS 应用内置 CLI / PATH / Homebrew；Windows 原生 exe / npm 原生二进制 / 已运行进程路径 / 常见安装路径；未找到时保留手动路径入口。不依赖 GUI 启动时的 PATH 完整性。
- 约每分钟查询一次；15 秒检查调度，重置时安排补查；失败按 60 / 120 / 240 / 300 秒退避，唤醒补查。单次请求最长 15 秒，响应每行最多 1 MiB，不重叠启动子进程；Windows 使用 CREATE_NO_WINDOW，完成与超时后回收子进程。
- 配置变更 / 断开增加请求代次，晚返回结果不得恢复旧状态。停止监控后，正在退出的查询最多受原 15 秒超时限制。
- 查询失败仅在本次请求已确认相同账户时使用本次运行的旧快照，并标记 stale。账户未知、变化或退出清除旧快照。重启重新查询，不加载历史会话作为当前额度。
- usedPercent 转换为 0–100 的剩余百分比；缺失或非法值为未知，不能补成 0 / 100。按实际 windowDurationMins 命名，resetsAt 按秒解析并在界面按系统时区展示。多个分组不混合计算。到重置时间只标记待更新，不自行补满。
- 低额度通知仅对当前展示来源启用；Codex 按账户、分组、窗口、reset 时间和 30% / 10% 阈值去重。无 reset 时间时不推送周期通知。去重和快照均仅保存在本次运行内。
- 既有人民币 Quota 类型保持原义；`quotaSource.ts` / `quotaDisplay` / `quotaState` 为桌宠提供选中来源的共享展示，`QuotaDetails.vue` 统一详情，`CodexSettings.vue` 管理连接。AI 云平台设置继续使用原始账户状态。

## 验证

- 源码：前端类型检查、构建、TypeScript / 脚本测试和 Rust 测试；新增覆盖额度分组、动态窗口、空值、超额、到期、来源隔离、设置校验、账户缓存边界、协议顺序、切号及超时回收。
- 浏览器：`tests/fixtures/codex-quota-browser-qa.js` 通过 Playwright CLI 运行，使用明确的模拟原生桥接数据；验证 13 种桌宠来源切换及独立值、详情无错误人民币 / 零点文案，440 / 300 / 190 尺寸下选择器和关闭入口可达，以及 stale / 未登录状态。
- macOS 真实账户：独立忽略测试 `codex::tests::live_codex_quota` 已读取本机账户实时额度，只打印分组数量，不保存或输出身份与凭据，不创建对话。
- 原生桌面：macOS 完整 Tauri 窗口 / 托盘操作、系统通知、睡眠唤醒及重启持久化尚未实机验收。Windows 原生构建 / 安装 / 账户验证需在 Windows 完成，不能以本机 Rust 测试或浏览器模拟代替。

常规检查：

```sh
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

显式真实账户只读验证（需当前用户已登录 Codex）：

```sh
cargo test --manifest-path src-tauri/Cargo.toml codex::tests::live_codex_quota -- --ignored --nocapture
```

## 2026-10-20 双额度显示验证

- 13 只桌宠复用 `CodexQuotaReadout.vue` 与 `quotaPresentation().windows`。AI 云平台沿用原展示；Codex 同时展示实际返回的窗口，角色分档继续取较低的有效值。现有账户查询、提醒和设置服务未改变。
- 源码 / 测试：217 项 TypeScript 测试及 12 项脚本测试通过；最终类型检查、契约生成和构建通过。构建仍提示现有主包超过 500 kB。
- 浏览器模拟：`tests/fixtures/codex-quota-browser-qa.js` 的 55 项检查通过，覆盖 13 只桌宠、440 / 300 / 190 尺寸、双额度、仅周额度、来源切换、详情和过期状态。在同一 Playwright CLI 会话继续执行 `tests/fixtures/codex-quota-edge-browser-qa.js`，156 项检查通过，覆盖 440 / 300 / 190 / 180 尺寸、100% / 0%、未知值及夜间待更新状态，并检查文字边界。截图位于仓库根目录 `output/playwright/codex-dual-*`。
- 本次未重新打包安装或验证 macOS / Windows 原生窗口、真实账户。上方真实账户记录属于既有接入验证，不代表本次双额度 UI 的实机验收。
