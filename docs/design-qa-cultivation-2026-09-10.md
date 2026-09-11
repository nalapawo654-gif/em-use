# 修仙渡劫事务所 · 验收记录

2026-09-10。角色方案：[cultivation-retreat.md](cultivation-retreat.md)。遵循 [公共交互规范](desktop-pet-interaction-standard.md)。

## 源码与自动测试：通过

- `npm test`：57 / 57，通过；含 5 项修仙测试，覆盖额度阈值、未知、三印顺序及重复命中、梳发有效移动、短动作恢复、设置兼容和其他桌宠偏好保留。
- `npm run build`：Vue / Electron TypeScript 检查、Vite 构建和主进程编译通过。
- `git diff --check`：通过。
- 新增 Scene、共享默认值 / 校验、App 标题 / 分支、浏览器选择器、设置仙境和尺寸预览、托盘切换。
- 账户 / 额度查询 / 真实刷新 / 原生拖窗继续复用共享服务；互动状态机没有额度写入路径。
- 角色和道具是独立透明图集，法阵 / 粒子 / 数值 / 命中区 / 面板分层。动画遵循轻柔模式，页面隐藏取消动作并暂停循环，卸载清理监听与捕获。

## 浏览器视觉与交互：通过（IPC 模拟边界）

本地 Vite + Playwright Chromium，真实 DOM 与指针操作；`tests/fixtures/desktop.html` 模拟 Electron 桥接，不是真实 OS 窗口。

- 未悬停：工具隐藏，角色和额度可见。悬停显示，关闭面板后移出隐藏；键盘 Tab 重新显示。
- 面板移出保持；更多玩法 / 仙境互斥；容器 Esc 关闭面板、结束互动。
- 三印错序 / 重复点击不推进，天 → 地 → 人完成。结束按钮可用。
- 梳发原地停留进度为 0，头发区域实际拖动完成；不调用移动窗口桥接。
- 主体拖动调用共享手势桥接，释放不会误触问安；仅证明浏览器捕获与模拟 IPC，不证明 OS 移动。
- 互动前后显示额度相同；动作期间缩放手柄隐藏。
- 标准 440 / 紧凑 300 / 迷你 190：玩法面板可滚动，符印和结束按钮可达，未出现素材缺失。
- signed-out、connecting、expired、resetting、unavailable、forbidden 均为 — 且保留各自说明；stale 保留上次数值并显示“数据待更新”。
- 六境已加载并截图；白天 / 夜晚、轻柔静止与普通动画预览检查。
- 浏览器切换仓鼠后切回修仙、页面重载：独立仙境保留；公共设置里显示修仙入口与仙境选择。
- 390 px 浏览器预览无水平溢出。
- 修仙页加载后控制台无运行错误；初次打开旧鱼缸页存在已有 favicon.ico 404。

截图位于 `output/playwright/cultivation-*`。核心截图：

- [完整白天预览](../output/playwright/cultivation-preview-day.png)
- [标准桌宠组件](../output/playwright/cultivation-standard.png)
- [迷你桌宠组件](../output/playwright/cultivation-mini.png)
- [迷你三印完成](../output/playwright/cultivation-mini-seals.png)
- [迷你玩法面板](../output/playwright/cultivation-mini-panel.png)
- [荷叶听雨](../output/playwright/cultivation-realm-rain.png)

## 未验证

- macOS 原生透明窗口、真实拖动 / 缩放、跨屏约束、托盘收起 / 恢复、鼠标穿透、重启持久化。
- Windows 原生交互、安装包与启动。
- 真实账户登录、真实额度请求与跨日同步运行。

以上不标记通过。本次未发版。双击、自动梳发和持续姿态为未设计能力，不适用。
