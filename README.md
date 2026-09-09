# EM Use · 额度小鱼缸

Windows / macOS 桌面悬浮额度应用。以玻璃鱼缸的水位展示 AI 云平台的每日剩余额度，支持喂食、点击小鱼、鼠标跟随、清洁和昼夜外观。

## 开发

Node.js 24，npm。

```bash
npm ci
npm run desktop
```

`npm run desktop` 启动 Vite 和 Electron。修改 Electron 代码后重新启动。`npm run dev` 只启动浏览器外观预览，预览会明确标注演示数据，不会连接真实账号。

```bash
npm test
npm run typecheck
npm run build
npm run pack
npm run dist
```

## 使用

1. 点击“登录 AI 云平台”，在应用打开的官方窗口扫码或确认授权。
2. 应用只观察自己的登录窗口向 AI 云平台发出的请求，获取 `X-Dong-Auth`、`X-Dong-User`、`X-Dong-Client`。
3. 通过真实额度接口验证后，登录窗口关闭，鱼缸显示剩余额度。
4. 正常情况下每 60 秒查询一次。失败时指数退避，睡眠暂停，唤醒重新查询。
5. 每日北京时间 00:00 重新查询。只有服务端费用日期进入新一天才恢复有效显示，不在本机假设满额。
6. 托盘可恢复悬浮窗、关闭鼠标穿透、打开设置或退出。关闭悬浮窗会收起到托盘。

金额来自 `GET https://aihub.eastmoney.com/ai-cloud-hub/coding-plan/usage`，使用 `dailyCostLimit` 与 `currentDayCost` 计算。费用可能延迟数分钟；费用时间超过 15 分钟、或已有结果超过 3 分钟未成功查询时标记过期。

## 安全与数据

- 登录网页关闭 Node，启用 sandbox/contextIsolation；主进程只向官方固定额度地址发送三个鉴权头，不带 Cookie，不允许接口重定向。
- 验证通过的鉴权头使用 Electron safeStorage 加密后保存到本机 userData。系统加密不可用时只保留在内存。
- 登录网页使用内存 Session；退出账号清除登录缓存和加密凭据。
- 凭据不会暴露给应用界面、写入日志或上传 GitHub。不要把本机 userData、Cookie 或请求头值提交到仓库。
- 设置与窗口位置存放本机；无需额外后端。

## GitHub 构建

推送 `main`、PR 或手动运行 **Build desktop apps**：

- Ubuntu 检查类型、测试、构建。
- Windows x64 生成 NSIS EXE。
- macOS arm64 / x64 生成 DMG 与 ZIP。
- 产物在 Actions Artifacts 保存 14 天。
- 推送与 package.json 版本相同的 `v*` 标签，全部平台成功后创建 GitHub Release 草稿及 SHA256 校验文件。

当前工作流为 **未签名内部预览包**。正式分发前配置 Apple Developer ID 签名、公证和 Windows 代码签名。没有在客户端嵌入 GitHub Token，也没有自动下载安装更新。

## 验收边界

纯数据测试覆盖真实字段结构、额度超额、非法数据、北京跨日、旧数据、鉴权字段完整性。真实扫码登录需要人工完成，跨平台交互需要实际 Windows / macOS 安装验证；构建成功不代表这些边界已经通过。

## 项目结构

```
electron/         桌面窗口、官方登录、额度查询、凭据存储、托盘
src/shared/       额度契约与跨日逻辑
src/components/   鱼缸渲染与设置
public/assets/    参考风格生成的分层素材
tests/            额度与鉴权契约测试
.github/workflows/ 双平台构建与草稿发布
```

设计依据：仓库中的原始鱼缸设计图。UI 将参考图的流量单位改为真实人民币每日额度。图片素材生成记录见 `public/assets/aquarium-generation.md`。

## 当前验证记录

- macOS 原生开发应用：人工官方登录、真实额度同步、加密保存、重启自动恢复已验证。
- 12 项额度契约测试、类型检查、生产构建通过；本机 Apple Silicon `.app` 打包通过。
- 视觉验收与明确边界见 [design-qa.md](design-qa.md)。预览截图均为演示额度。
