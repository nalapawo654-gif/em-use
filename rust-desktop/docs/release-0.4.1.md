# 0.4.1 · 无损素材压缩与下载站

日期：2026-09-11。此记录补充 [0.4.0 迁移验证](verification.md)。

## 素材与画面

原 PNG 共 112,823,611 字节。移除 7 张未使用的旧图，发布端保留 56 张有效图，合计 74,987,190 字节，减少 37,836,421 字节（33.5%）。原始 PNG 和生成说明留在仓库根目录作为 Electron 对照，不再随 Rust 客户端打包。

- 48 张不透明素材使用无损 WebP；8 张透明素材保留 PNG 并无损优化。尺寸、帧数和每个 RGBA 像素一致。
- 透明图不强行转换 WebP：图片库虽然可以解码出相同 RGBA，但浏览器在预乘透明度与混色时存在不同取整行为，可能影响半透明边缘。保留 PNG 的方案通过实际浏览器对照。
- `scripts/optimize-assets.py --check` 独立解码全部 56 张图，逐像素比较；CI 也执行此检查。[逐图字节数和哈希](asset-compression.json)可复核。
- `verify:parity` 对照 80 个绘制、动作与手势文件，允许图片 URL 扩展名变化；原有集成例外保持明确列出。窗口手势、动作状态机及渲染参数未因压缩改写。
- Chromium、WebKit：各 6 类宠物 × 静态与两个动画时间样本，合计 36 对截图完全一致，两个动画样本确实不同，图片加载和页面脚本无异常。[结果](compression-visual-parity.json)。
- 测试时钟同时控制 requestAnimationFrame、组件 setInterval 与 CSS 动画时间；等待 CSS 动画的暂停承诺完成后再截图，避免 WebKit 的待执行暂停造成原版自身也不一致。全 WebP 的试验及暂停时序不稳定的采样不用于最终通过结论。

## 下载站

`website/` 保存模板、CSS、交互脚本和六张来自实际应用截图的展示图，总展示图片约 0.8 MB，独立于客户端素材。静态发布脚本将以下内容与安装包一起生成：

- 根目录 `index.html` 和 `em-use/index.html`：同一介绍与下载页，两处入口均有效。
- `em-use/site-assets/0.4.1/`：按版本存放网页展示图片，支持长期缓存。
- 三平台下载卡片：Windows x64 EXE、Mac Apple 芯片 DMG、Mac Intel DMG；显示 CI 实际文件大小。更新专用 `.app.tar.gz` 不作为首次安装下载入口。
- 明确说明东方财富 AI 云平台每日额度、六类桌宠、互动换装、安装、登录及更新方式；截图标注示例额度，不把演示值当成真实账户数据。
- 不加载外部字体、CDN 脚本或在线图片，适合内网静态服务器。

浏览器检查通过：1440 px 桌面布局；390 / 320 px 手机布局无水平溢出；六个桌宠选择按钮正确切换图片与说明；三平台下载路径正确；安装/更新说明可以展开。没有页面脚本异常或破图。[页面检查结果](download-page-qa.json)；[桌面版页面预览](qa/download-page.png)。

## 验证边界与上传

85 个原有玩法与共享逻辑测试、5 个发布测试、类型检查及 Vite 生产构建通过。正式标签 `v0.4.1` 指向源码提交 `fa95836`；[GitHub Actions 34570218470](https://github.com/wantwant123/em-use/actions/runs/34570218470) 的 verify、三个 package 和 static-release 作业全部成功。安装包均由 GitHub Actions 构建，更新签名随发布产物生成。

以下为 static-release 作业读取真实文件后输出的大小，MB 按 1,000,000 字节计算：

| 平台 | 安装包字节数 | 大小 |
| --- | ---: | ---: |
| Windows x64 EXE | 78,264,545 | 78.3 MB |
| Mac Apple 芯片 DMG | 81,321,370 | 81.3 MB |
| Mac Intel DMG | 80,957,000 | 81.0 MB |

同架构 Mac Apple 芯片 DMG：v0.4.0 为 113,182,581 字节，v0.4.1 为 81,321,370 字节，减少 31,861,211 字节（28.2%）。该比较使用实际安装包体积，不以素材体积代替。

[静态发布产物 EM-Use-v0.4.1-static-server](https://github.com/wantwant123/em-use/actions/runs/34570218470/artifacts/10187754398) 为 401,193,395 字节，包含三平台安装包、Mac 更新归档、更新签名与清单、SHA-256 校验文件和完整网站。此汇总 ZIP 的大小不是单个平台安装包大小。GitHub artifact digest：`sha256:2440ba65ef88738697764055882af4f2b57ea892bd811c7f303d35b421f00f43`。

此轮未执行原生桌面交互、真实账户登录或 0.4.0 → 0.4.1 的安装升级闭环。更新包签名沿用既有密钥；Apple 公证和 Windows Authenticode 仍未配置。

上传时将静态 ZIP 中的 **根目录 index.html 和整个 em-use 目录**合并到网站根目录，保留已有历史版本。先上传版本文件和页面图片，最后上传 `em-use/stable/latest.json`。本次不直接操作用户静态服务器。
