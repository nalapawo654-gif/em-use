# 单独更新说明页

说明页源码在 `website/`，桌宠目录在 `scripts/download-page.mjs`；数量和切换序号从目录生成。新增桌宠时同时补齐目录介绍和 `website/assets/<id>.webp` 实景图。

已有安装包时，无需重新运行 GitHub Actions。准备 JSON，填写线上版本及三个安装包的 `platform`、`file`、`bytes`，然后在 `rust-desktop/` 执行：

```sh
node scripts/website-only.mjs downloads.json output/website-only/site
```

输入结构为 `{ "version": "0.4.3", "downloads": [{ "platform": "windows-x86_64", "file": "EM-Use-0.4.3-windows-x86_64.exe", "bytes": 137929675 }, ...] }`。另外两个平台是 `darwin-aarch64` 与 `darwin-x86_64`，使用 `.dmg` 安装包。文件名和大小应从实际已发布文件核实。输出目录必须不存在。

先上传输出中的 `em-use/site-assets/<version>/`，再覆盖根目录与 `em-use/` 下的两个 `index.html`，按同名目录合并。保留服务器已有 `releases/` 和 `stable/latest.json`；网页替换包不包含也不改写它们。上传后强制刷新浏览器。

2026-09-12：补齐肥嘟嘟、水墨小狐、破产招财猫、摸鱼小恐龙、斯卡蒂 · 月汐，共 11 只桌宠；图片来自当前渲染组件的浏览器截图，使用演示额度。补充 15% 及以下进入最后一档形态的说明。

验证：5 项发布测试通过；浏览器逐一切换 11 只桌宠，图片加载、名称、选中态正常；1440 px 桌面和 390 / 320 px 手机检查通过，无页面脚本异常或破图，手机无水平溢出。线上 v0.4.3 三个平台安装包经 HTTP HEAD 确认可访问，沿用其真实字节数。本次只交付网页，服务器替换由用户执行，不新增原生桌面或真实账户验收结论。
