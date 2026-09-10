# 仓鼠跑步第三只后脚修复 · 2026-09-10

## 原因与修改

用户圈出的脚来自源素材，非帧率或两帧交叉淡入：七套 dressed 图集的第 2、4 列，上下两排均多画了一只后脚，共 28 帧。原绘制每次 clearRect 后只绘制一张完整角色帧，轮子底图也没有仓鼠脚。

使用内置 image_gen 修正源图。修正版保存在 `public/assets/hamster/dressed/corrected/`，七套各一张 1536×1024 PNG；提示词与生成来源记录在该目录的 `generation-prompts.json`。经典、雨天首次生成连接失败，重试成功。

`src/hamster/sprites.ts` 只从修正版读取索引 1、3、7、9，另外八帧继续使用原素材，避免生成时对其他姿态的变化进入运行循环。每次替换的是完整角色，未添加独立脚部层、帧混合或遮盖。保留六帧节奏、统一落脚基线、衣服随身体动作的规则。原始素材保留以便对照。

此前 `design-qa-hamster-motion-2026-09-10.md` 的“逐张目视检查”未发现这些三脚帧，不能作为后脚数量正确的证据；该项以本次 84 张实际运行帧检查为准。

## 验证

- 源码 / 测试：类型检查、现有 52/52 测试、Vite 构建、Electron 编译、diff 空白检查通过。测试通过不是素材解剖正确的证明。
- 浏览器：`tests/fixtures/hamster-feet.html` 使用实际 HamsterVisual 组件和实际加载后的 84 帧；逐张目视检查七套装扮，每张均只有两只后脚。
- 七套换装加载成功；日班正常日常完整采样 0–5，疲惫日常 6–11，加速跑轮 0–5；轻柔模式两次采样均固定在疲惫第 6 帧。300px / 190px 组件对照可见。最终页面完整加载无 console warning/error 或 pageerror。
- macOS 原生：刷新当前连接本地 Vite 的 Electron 桌宠，实际看到修正版节日装扮与两只后脚，额度区正常显示。仅为当前装扮的原生抽样，未把它扩展为全部装扮 / 全时序原生验收。
- 未重新验证 Windows、安装包分发、登录与额度接口全链路；未改账户、共享手势或原生设置。

## 证据

- `output/playwright/hamster-feet-before.png`：修复前逐帧对照。
- `output/playwright/hamster-feet-{classic,worker,nightshift,rain,summer,winter,holiday}-frames.png`：七套实际运行帧，各 12 帧。
- `output/playwright/hamster-feet-final-live.png`：日班 300px / 190px 运行组件。
