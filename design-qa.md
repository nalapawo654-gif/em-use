## 2026-09-15 · 剩余九宠日程

新增九种独立 PNG 日程物料与角色台词，全部复用共享日程服务。低额度姿态、消息信物和迷你顶栏的实际碰撞已修正；原角色图集、动作状态机和旧手势不变。

- 源码：Tauri build、153+5 测试、Rust 34 通过 / 3 忽略，parity 77 源文件 / 56 旧资产 / 48 Tauri 资产通过。
- 浏览器：432 布局、45 换装、88 菜单操作、900 帧待机、9 日程打开、18 确认 / 稍后提醒响应通过，无页面错误。日程展开后消息入口隐藏，实点未触发角色动作或拖窗。
- 原生桌面 / 真实账户到点提醒：本轮未验证。
- [成品图与全部证据](rust-desktop/docs/design/nine-calendar-v1/README.md)。

# 小鱼缸缸沿挂历验收 · 2026-09-15

浏览器设计与交互验收：final result: passed。原生桌面验证仍待进行。

采用玻璃外左上挂历，固定弯钩贴合缸沿。主体、水位、鱼装扮、宝箱及洞穴素材保持原样。纸面短暂淡闪，轻柔模式静态。共用日程服务及入口控制，不增加另一套计时器或账户。

- [实际会前提醒](rust-desktop/docs/design/aquarium-calendar-v1/qa/reminder.png) · [改动前](rust-desktop/docs/design/aquarium-calendar-v1/qa/before.png)
- [1152 组布局结果](rust-desktop/docs/design/aquarium-calendar-v1/qa/layout-result.json) · [连续游动结果](rust-desktop/docs/design/aquarium-calendar-v1/qa/swimming-result.json)
- [完整验收与未验范围](rust-desktop/docs/design/aquarium-calendar-v1/README.md) · [物料与内置 image_gen 提示词](rust-desktop/docs/design/aquarium-calendar-v1/asset-production.md)
- 遮挡结果：0；新增入口不拦截鱼 / 宝箱 / 洞穴及原控件；擦玻璃 29% 进度经过日历开关仍保留。原生焦点、多屏、真实到点与系统通知未验。
- 已修：开发验证夹具从未知额度恢复后缺失时间字段；补全模板后重跑整个矩阵，零错误。牛马入口的共享改造已复查外观和开关。
- 本轮无未解决的浏览器 P0/P1/P2。180px 日历时间是环境提示，完整可读信息在外侧独立卡片内。

---

# 充气牛马日历验收 · 2026-09-15

选定方案 3「草地翻页历」，实现与原角色独立的日程入口及提醒。详细证据和原生未验范围见 [实施验收](rust-desktop/docs/calendar-implementation.md)。

- [原设计](rust-desktop/docs/design/buddy-calendar-v1/03-grass-flip-calendar.png) · [同屏视觉对照](rust-desktop/docs/design/buddy-calendar-v1/qa/comparison.png)
- [实际待机](rust-desktop/docs/design/buddy-calendar-v1/qa/idle.png) · [五分钟前提醒](rust-desktop/docs/design/buddy-calendar-v1/qa/reminder.png) · [日程卡](rust-desktop/docs/design/buddy-calendar-v1/qa/agenda.png)
- P1 已修：迷你日历与原状态及左下缩放柄重叠；只缩小新增日历后 160 组布局零冲突。
- P1 已修：日程提醒与消息气泡并发；互斥提醒，邮包保留。
- 视觉偏差说明：原概念角色重绘不进入生产；日历移至木牌左侧以避让原泵和头部。正式运行使用原角色，非概念稿换皮。无未解决的浏览器 P0/P1/P2；原生层尚未验收。

---

# 仓鼠动作修订验收 · 2026-09-10

本轮修复：七套衣服与身体整帧绘制、小脚短步跑动、监工猫的哈欠/睡眠Zzz/偷吃表情动画。

- [完整验收与边界](docs/design-qa-hamster-motion-2026-09-10.md)
- [完整穿着与猫表情逐帧对照](output/hamster-v3/dressed-and-cat-frames.jpg)
- [素材与实际提示词](public/assets/hamster/dressed/generation.md)

52项测试、类型检查及构建通过。浏览器检查了整身穿着、猫动作/取消/轻柔模式和小窗口提示；macOS客户端已重启并看到新装扮与哈欠反馈，保留用户所选装扮继续运行。未将浏览器结果视为全部原生能力验收。

[上一轮布局验收](docs/design-qa-hamster-2026-09-10.md) · [旧牛马验收](docs/design-qa-buddy-2026-09-10.md)
