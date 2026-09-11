# Rust 迁移验证记录

后续版本见 [0.4.1 无损压缩与下载站验证](release-0.4.1.md)。

日期：2026-09-11。版本：0.4.0。旧版目录：仓库根目录；迁移版：`rust-desktop/`。

## 已完成的验证

| 层次 | 结果与证据 |
| --- | --- |
| Rust 编译 | `cargo check` 通过；`cargo run` 成功编译并启动 macOS 开发进程，无启动错误日志。未生成本地安装包。 |
| Rust 测试 | 5 项通过。其中一项读取旧版 TypeScript 规则生成的 28 个额度样例和 180 个窗口几何样例，逐项核对费用、跨日、新鲜度、错误分类、缩放锚点和屏幕约束。浮点金额/百分比容许小于 1e-10 的表示误差。 |
| 现有玩法测试 | 85 项全部通过，覆盖六类宠物、动作替换和完成条件、额度语义、精灵抠色、运动参数与共享窗口几何。 |
| 发布目录测试 | 4 项通过：版本一致性、完整平台矩阵、缺失平台拒绝生成清单、签名文件不一致拒绝生成清单。样例安装包为测试数据，不代表实际安装或签名更新测试。 |
| 前端 | `vue-tsc --noEmit` 和 Vite 生产构建通过。保留了原渲染分辨率；主 JS 块约 512 KB，有原有体量相关的构建提示。 |
| 素材和源码保真 | `npm run verify:parity`：171 个文件 SHA-256 一致，包含原有角色素材、绘制、动作、CSS、共享窗口手势及设置校验。明确排除集成修改的桥接文件、API 类型、设置面板。 |
| Chromium 视觉 | 6 只宠物 × 静态及两个动画时间样本，共 18 对新旧截图完全一致。 |
| WebKit 视觉 | 同上，共 18 对新旧截图完全一致。等待精灵图解码完成后再采集，避免把加载状态当作宠物画面。 |
| 动画确实运行 | 两种引擎下，每只宠物的两个动画样本均不相同。测试固定随机数、Canvas 和 CSS 动画时间，并未关闭全部动画来获得一致结果。 |
| 浏览器交互 | 六只宠物在夜间标准 440 px、紧凑 300 px、迷你 190 px 的 18 组检查通过：移出隐藏设置入口，移入可见，宽度正确，无页面异常。见 [interaction-qa.json](interaction-qa.json)。这不代替真实 OS 缩放。 |
| GitHub Actions 实际打包 | `main` 首轮构建和 `v0.4.0` 标签构建的 Windows x64、macOS ARM64、macOS Intel 打包均通过。安装包和更新签名文件已上传 Actions Artifacts。完整矩阵通过后才组装静态发布目录。 |
| 静态服务器 | 对用户指定根地址执行只读 HTTP 请求，返回 200。当前根目录是静态目录服务；本次未上传或修改服务器文件。 |

总计 94 项测试通过（85 + 4 + 5）。截图哈希见 [visual-parity.json](visual-parity.json)，可视化结果见 [visual-report.html](visual-report.html)。六张迁移版静态截图保存在 `docs/qa/`；完整采样保存在本地 `output/playwright/`，该输出目录不提交。

## 视觉比较方法与解释

使用原有 `tests/fixtures/desktop.html`，通过相同测试桥接向旧版与 Rust 版传入 68% 演示额度、默认装扮、标准 440 px 窗口、白天主题。测试脚本见 `scripts/visual-qa.cjs`，通过 Playwright CLI 的 `run-code` 执行，需要同时启动根目录 5173 和迁移目录 5174 的 Vite 服务。WebKit 运行同一脚本，仅变更输出目录。

为消除截屏时刻差异，固定随机数与 requestAnimationFrame 时间，对 CSS 动画统一定位；静态后以 608 ms 间隔取得两帧。等待图片完成和电池 Canvas `data-loaded=true` 后采样。最初未统一 CSS 时钟及未等待 WebKit 解码的采样被弃用，不用于一致性结论。

36 对完全一致指 **同一浏览器引擎中旧代码与迁移代码一致**；不是说 Chromium 与 WebKit 本身所有抗锯齿、字体和 GPU 输出都相同。固定样本不等于所有皮肤、所有玩法和所有时间帧的穷举验收；其他渲染状态通过素材/动作文件字节一致与原有规则测试覆盖。

## 2026-09-11 签名配置与远程发布补充

- 发布源码提交：`0f282092b3a4c9d640b56d73aa79e6b0c239db43`；正式标签：`v0.4.0`。
- [main 首轮构建](https://github.com/wantwant123/em-use/actions/runs/34564962515)：验证与三平台安装包构建全部成功。
- [v0.4.0 正式发布](https://github.com/wantwant123/em-use/actions/runs/34566705623)：验证、三平台安装包构建和静态发布目录组装全部成功。
- [静态服务器发布包](https://github.com/wantwant123/em-use/actions/runs/34566705623/artifacts/10186520574)：`EM-Use-v0.4.0-static-server`，Actions 报告 559,522,484 字节；产物内包含 `EM-Use-v0.4.0-static-site.zip`。解压内层 ZIP 后，将 `em-use` 合并到服务器根目录，先上传版本目录，最后上传 `em-use/stable/latest.json`。本次没有代替用户上传静态服务器，也没有在本机重新下载并校验完整三平台 ZIP。
- GitHub Actions Secrets 已配置 `TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`；Actions 变量 `TAURI_UPDATER_PUBLIC_KEY` 与应用配置中的公钥一致。密钥不是每次构建临时生成，后续版本沿用同一对密钥。
- 私钥与密码只保存在 GitHub Secrets 和本机被忽略的 `.local-data/release-signing/` 中。该目录权限为 0700，密钥和密码文件为 0600；未进入 Git 提交。
- 本地挑战文件的签名及受信任注释验签通过，篡改内容被拒绝。另从 main Actions 下载了真实 Mac ARM 更新包，使用应用内置公钥与独立 Ed25519 实现验证内容签名及受信任注释，均通过。该更新包为 `EM-Use-0.4.0-darwin-aarch64.app.tar.gz`，111,953,360 字节，SHA-256：`3bd27245da59ba9939fa791cb149139b25676b1e0140ddbb9c98badbc7426851`。这是 main 首轮产物的证据，不能将其哈希套用到重新构建的标签产物。
- 独立下载验签覆盖上述 Mac ARM 产物；Windows、Mac Intel 和标签产物的证据是 Actions 签名打包步骤成功，未声称在本机逐包独立验签或安装成功。
- 更新签名不是 Apple Developer ID 公证或 Windows Authenticode 签名。当前没有相应操作系统发行证书，未配置这两类发行者身份签名。

## 尚未验证的环节

- macOS 开发二进制已启动，但桌面自动化工具无法识别该未打包程序；透明背景、托盘、穿透、跨 DPI 拖动、屏幕拔插和持久化恢复未完成原生 UI 验收。
- Windows 安装与原生桌面交互尚未运行。
- 新登录窗口中的真实扫码、三个请求头捕获、系统凭据库持久化、真实额度接口未做账户验收。登录注入只观察官方页面主文档的 fetch/XHR；未来站点若改用 Worker/Service Worker，需要调整捕获方案。
- 未执行从 0.4.0 到更高版本的实际下载、签名验证、安装和重启；静态清单生成测试不代替升级闭环。
- Apple 公证和 Windows Authenticode 不在当前签名配置中；Tauri 更新签名不等同于操作系统代码签名。

这些边界应使用 GitHub 构建的对应系统安装包继续验收。旧版 Electron 保留作对照，首次切换 Rust 版需手动安装并重新登录。
