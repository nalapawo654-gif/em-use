# EM Use v0.5.0

2026-09-22。发布仓库：`nalapawo654-gif/em-use`。

用户可见说明以 [release-notes/0.5.0.md](../release-notes/0.5.0.md) 为唯一来源，随包写入静态更新清单。继承 v0.4.10 的食人花、土豆战神及均分额度形态，本版修正土豆战神的旗帜与日程牌文字。

- 加油旗使用独立透明 [五星红旗物料](../public/assets/potato/china-flag.png)，原图集的其他道具继续复用；[生成说明](potato-flag-prompt.md)。
- 日程文字以米白色屏幕中心定位，按屏幕倾角对齐，移除后续样式中覆盖定位的旧规则；“今日”和具体时间共用同一中心。

## 浏览器验证

- 五星红旗实际资源加载、透明 alpha、动作自动结束，以及 180px 迷你窗口的手动结束均通过。
- 440 / 300 / 190 / 180px 下，“今日”和时间共八种组合均保持屏幕中心且不越界。
- [旗帜效果](../../output/playwright/potato-china-flag-440.png)、[今日日程](../../output/playwright/potato-calendar-centered-440-today.png)、[具体时间](../../output/playwright/potato-calendar-centered-440-time.png)、[迷你日程](../../output/playwright/potato-calendar-centered-180-today.png)。

## 发布边界

发布前通过 171 项业务测试、10 项脚本测试及 57 项 Rust 测试，7 项真实账户测试明确忽略。类型检查、生产构建、版本 / 说明一致性、77 个渲染文件迁移对比、57 项 Tauri 素材及 56 项历史图集完整性检查通过。

标签工作流生成 Windows x64、macOS ARM、macOS Intel 安装包及静态服务器整包，以该标签对应 Actions 的最终产物为准。本版未进行安装后的原生桌面或真实账户验收。

Mac 保留手动 DMG 替换，Windows 保留签名自动更新。静态服务器仍需手动上传：保留旧版本，先上传本版目录和页面，最后更新 `em-use/stable/latest.json`。
