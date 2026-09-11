# EM Use · Rust 桌面版

版本 **0.4.1**。独立项目目录，原项目保留作 Electron 对照基线。

使用 **Rust + Tauri 2 原生层，Vue + Canvas 渲染层**。窗口、托盘、凭据库、网络查询、持久化和更新均在 Rust 中实现；六只桌宠的抠色、动作状态机、帧节奏、CSS 和共享窗口手势保留。48 张不透明图使用无损 WebP，8 张透明图使用优化 PNG，保持每个 RGBA 像素、分辨率和帧数；透明图保留 PNG 以避免浏览器预乘透明度取整差异。原始素材保留在仓库根目录作为对照。

## 开发和验证

```sh
cd rust-desktop
npm ci
npm run desktop                 # 本地开发运行，不生成安装包
npm test                        # 85 个原有测试 + 发布目录测试
npm run build                   # 仅编译前端资源
npm run verify:parity            # 对照绘制/手势逻辑及已验证素材哈希
python3 -m pip install Pillow==11.3.0
npm run verify:assets            # 逐张解码并比较 RGBA 像素
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

只在 GitHub Actions 构建分发安装包。根目录 `.github/workflows/build.yml` 已切换为 Rust 项目，不再打包 Electron。

## 版本和发布

```sh
npm run version:set -- 0.4.1
```

该命令同步 `package.json`、`package-lock.json`、`Cargo.toml`、`Cargo.lock`、`tauri.conf.json`。CI 检查这些版本一致，稳定发布的标签必须是对应的 `v0.4.1`。提交版本变更后推送标签，即可触发完整发布。

普通 main / PR / 手动工作流构建用于验证；推送 `v*` 标签生成静态站点发布包。平台分别在原生 Runner 编译：Windows x64（NSIS `.exe`）、macOS ARM64 和 Intel（`.dmg` + `.app.tar.gz` 更新包）。本机不生成分发安装包。

本仓库已于 2026-09-11 配置下列 GitHub Actions 更新签名项；公钥同时固定在应用配置中，构建时会拒绝不一致的公钥，避免误换密钥：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| Actions Secret | `TAURI_SIGNING_PRIVATE_KEY` | Tauri 更新签名私钥全文 |
| Actions Secret | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥密码；未设置密码时可不填 |
| Actions Variable | `TAURI_UPDATER_PUBLIC_KEY` | 对应公钥全文 |

迁移到另一个新仓库且尚无更新签名密钥时，可在安全目录运行 `npm run tauri -- signer generate -w /绝对路径/em-use-updater.key`。私钥不要提交进仓库。每次发布必须沿用同一对密钥，否则旧客户端无法验证新版。标签构建在密钥缺失时明确失败，不生成假装可更新的发布包。普通验证构建可在无密钥时生成不带自动更新签名的安装包。

更新签名用于客户端验证安装包来源，与 Apple/Windows 系统代码签名不同。当前工作流未配置 Apple 公证或 Windows Authenticode，操作系统可能显示未签名发布者提示。

本机私钥与密码备份位于仓库根目录下被 Git 忽略的 `.local-data/release-signing/`，目录权限 0700、文件权限 0600。请单独安全备份；不要删除或公开该目录，也不要用新密钥覆盖已发行应用的密钥。

## 手动上传静态服务器

1. 下载 GitHub Actions 中 `EM-Use-v版本-static-server` Artifact，解开外层 Artifact ZIP，再解开里面的 `EM-Use-v版本-static-site.zip`。
2. 将 `em-use/releases/版本/` 完整上传到 `http://172.27.12.77:5500/` 对应网站根目录下，保留历史版本。
3. 上传 `em-use/site-assets/版本/` 页面图片、`em-use/index.html` 和根目录 `index.html` 下载页。根目录与 `/em-use/` 均可访问介绍页，链接始终指向 `/em-use/releases/版本/`。
4. **最后上传 `em-use/stable/latest.json`**，最好用临时文件重命名替换。先传大文件，再切换清单，避免更新中断。

```text
网站根目录/
├── index.html
└── em-use/
    ├── index.html
    ├── site-assets/0.4.1/
    ├── stable/latest.json
    └── releases/0.4.1/
        ├── EM-Use-0.4.1-windows-x86_64.exe
        ├── EM-Use-0.4.1-windows-x86_64.exe.sig
        ├── EM-Use-0.4.1-darwin-aarch64.dmg
        ├── EM-Use-0.4.1-darwin-aarch64.app.tar.gz
        ├── EM-Use-0.4.1-darwin-aarch64.app.tar.gz.sig
        ├── EM-Use-0.4.1-darwin-x86_64.dmg
        ├── EM-Use-0.4.1-darwin-x86_64.app.tar.gz
        ├── EM-Use-0.4.1-darwin-x86_64.app.tar.gz.sig
        ├── SHA256SUMS.txt
        └── version.json
```

客户端启动 10 秒后、随后每 6 小时检查；设置和托盘可手动检查。检查地址固定为 `http://172.27.12.77:5500/em-use/stable/latest.json`。只有新版本才显示安装入口，用户点击后下载、验证签名、安装并重启。内网不通、清单缺失和签名校验失败都保留原版并显示错误。建议静态服务器对 `latest.json` 返回 `Cache-Control: no-cache`。旧版 Electron 不会自动升级到 Rust，第一次需安装 Rust 包。

## 迁移和边界

- Rust 应用使用独立标识 `com.wantwant123.emuse.rust` 与独立数据目录，不覆盖旧版设置或读取旧版加密凭据。第一次启动需要重新登录。
- 登录窗口使用临时浏览器会话，仅官方来源可提交三项 `X-Dong-*` 头；Rust 验证真实额度响应后写入系统 Keychain / Windows Credential Manager。令牌不发送给桌宠或设置窗口。
- 登录捕获采用文档启动时的 fetch / XHR 请求观察。服务工作线程、未来官方站点请求实现变更、扫码跳转兼容性需要真实登录验证；浏览器预览不能替代这一层。
- 复用 `src/windowGestures.ts`，Rust 负责屏幕工作区和 1:1 几何；轻点、5 px 拖动阈值与拖后 400 ms 点击抑制保留。
- 设置和额度通过单个共享 Rust 状态广播到桌宠/设置窗口。默认启动关闭穿透；托盘可恢复和切换穿透。
- 15 秒轮询检测唤醒与跨日，网络请求 15 秒超时、失败退避；旧响应有 generation 校验，退出不会被晚到的响应重新登录。
- 截图使用当前 DOM/Canvas 生成透明 PNG，Rust 系统保存对话框选择目的路径；不调用系统全屏截图。
- 源码、测试、浏览器、原生窗口、真实账户及实际升级验收分别记录在 [迁移验证报告](docs/verification.md) 和 [0.4.1 压缩及下载页验证](docs/release-0.4.1.md)。

参考：[Tauri 更新签名与静态清单](https://v2.tauri.app/plugin/updater/)、[WebviewWindow API](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindow.html)、[项目桌宠基础交互规范](../docs/desktop-pet-interaction-standard.md)。
