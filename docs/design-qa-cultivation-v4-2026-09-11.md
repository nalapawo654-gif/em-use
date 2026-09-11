# 修仙第四轮：六个日常随机事件

2026-09-11。在现有修仙实现上增加六个事件，角色规则见 [第四轮方案](cultivation-retreat.md)。本轮没有提交、打包安装程序或发布。

## 实现

- 吐纳 / 观星：打坐犯困；御剑：飞剑失控；炼丹：丹成异象 / 炸炉；各功法均可能遇到仙鹤来访与纸鹤传书。
- 八事件（含已有渡劫 / 顿悟）统一按功法过滤、权重抽样、排除前次事件，进入后冻结功法与换景，结束恢复。专属事件不会出现在不匹配的功法中。
- 新事件角色、飞剑、炉盖、金丹、烟雾、灰痕、仙鹤、灵草、纸鹤和书信使用同一有效事件时间。渲染计时 30 Hz，沿用单个角色网格。暂停后恢复不重播开场。
- 所有事件均自动完成，并提供“收心”鼠标退出和 Esc。奇遇提示出现时缩放手柄隐藏。浏览器有演示按钮，桌面随机触发。
- 修正了浏览器发现的丹炉落脚位置、金丹掌边落点和书信样式选择器误匹配；迷你窗口使用简短事件名 / 阶段提示。

## 源码与测试

- 构建与 Vue / Electron 类型检查通过。
- `npm test`：67 / 67 通过，包含八事件完整生命周期、按功法过滤、权重边界、避免连续重复、功法稳定时间、重复预览序号、暂停、旧设置兼容以及低额 / 零额 / 未知的姿态保留。
- `git diff --check` 通过。修仙实现本来就在未跟踪文件内；构建包含这些文件。

## 浏览器检查

- 六种新增事件逐一从真实预览按钮播放，截图保存；专属事件匹配功法，各事件的“收心”均能清理临时物件，无页面 JavaScript 错误。
- 打开面板暂停事件，关闭后有效时间只增加约 131 ms（开关操作时间）；手动递茶期间奇遇收起并暂停，结束后恢复。
- 再点同一预览按钮从头开始；Esc 清除；切换鱼缸再回来没有残留事件 / 物件；上述操作前后演示额度保持一致。
- 标准 440、紧凑 300、迷你 190 px 组件预览：以可复现随机输入 0.6，让实际调度器从炼丹功法自然抽到炸炉，三种尺寸均进入正确事件、显示退出入口，并在事件期间隐藏缩放手柄；演示额度始终 68%。
- 轻柔模式中纸鹤传书保持静态书信（计算样式 animation / transform 均为 none），仍在 12 秒内正常结束。额外模拟 `visibilitychange` 隐藏通知后，事件有效时间与暂停样式保持冻结；该检查仅证明处理函数链，不等价于 OS 隐藏窗口。
- 新开浏览器页的尝试没有让原页的 `document.hidden` 变为 true，因此不把该尝试作为真实隐藏页面暂停的验收；暂停逻辑已有状态测试覆盖。

## 验证边界

所有浏览器画面采用预览数据或 `tests/fixtures/desktop.html` 的模拟桥接，不是实际 Electron 窗口。macOS / Windows 原生透明、GPU 环境、OS 拖窗、托盘、鼠标穿透、原生重启持久化和真实账户额度均未在本轮验收。没有更改账户、额度、窗口手势或共享持久化服务。


## 演出留档

六个事件在实际浏览器页面中完整播放并自动结束，每段结束均重新出现常态功法；录制期间无页面 JavaScript 错误。录屏通过预览按钮依次演示，不代表六个事件在一次自然随机运行中恰好依次出现。

- [六事件完整录屏](../output/playwright/cultivation-v4-stories.webm)
- [打坐犯困](../output/playwright/cultivation-v4-drowsy.png)
- [飞剑失控](../output/playwright/cultivation-v4-runaway-sword.png)
- [丹成接丹](../output/playwright/cultivation-v4-golden-pill.png)
- [炸炉烟雾](../output/playwright/cultivation-v4-furnace-pop.png) / [暂时熏黑](../output/playwright/cultivation-v4-soot.png)
- [仙鹤来访](../output/playwright/cultivation-v4-spirit-visit.png)
- [纸鹤传书](../output/playwright/cultivation-v4-crane-letter.png)
- [迷你尺寸自然触发](../output/playwright/cultivation-v4-mini-random.png)
