# 消息物料随角色姿态融合

2026-09-14，按用户后续要求修订。此记录替代 v4 中四只角色固定摆放的结论；月汐保持 v4 方案。

## 已实现

| 角色 | 正常 / 持物 | 疲惫、累倒及玩法避让 |
| --- | --- | --- |
| 肥嘟嘟 | 空手时捧奶茶信；原奶茶姿态只挂一封心形便笺，不重复杯子 | 靠垫姿态放在膝前，趴倒和仰躺时放地上；饼干和电脑使用小便笺，避免另一个大杯遮挡 |
| 小仓鼠 | 齿轮信随当前衣服的实际跑动帧绘制，原前爪盖在信封前 | 低电量 / 睡觉放在轮架前、脸侧地面；喂食时靠在身体侧下方，避开嘴和食物 |
| 海狸鼠 | 两条现有手臂改用持信锚点，信封绘在远手与近手之间 | 倒下放在脚边地面，避开嘴和木头；喝水、啃木头、接鸟等玩法靠在身侧下方 |
| 小恐龙 | 使用现有持手机骨骼姿态；喝茶时手机在左爪，保留原杯和右爪 | 趴睡时放在尾侧地面；食物、电脑时靠膝前 / 身侧；飞行随身体变换，伸懒腰时放地上 |
| 修仙 | 普通尺寸纸鹤移到岛屿左侧、额度牌下面 | 190 / 180 像素时改用右上空位，避开额度牌、底部玩法栏、伴生仙鹤和修炼法器 |

`src/shared/characterMail.ts` 仅共享道具解码、可见状态及画布到点击区域的映射。消息来源、窗口、计数、隐私、账户和手势仍复用既有服务。角色各自决定姿态与道具锚点。手爪遮挡使用同一帧的原有像素，不新增肢体。肥嘟嘟持物时保留眼、耳、鼻与点头微动作，需要空手的自动微动作暂不抽取；手动玩法照常使用各自姿态。

## 查看结果

- [五只对比图](overview.html) / [PNG](overview.png)：正常与累倒，修仙普通与迷你尺寸。
- [完整姿态与玩法截图](states.html)。
- [仓鼠 7 套服装 × 12 跑动帧](hamster-run-frames.png)：使用实际 `loadHamsterSkin` 的修正帧选择路径。

## 验证边界

- TypeScript 149 个测试和站点脚本 5 个测试通过；类型检查、合同检查和前端构建通过。构建仍有原有大 chunk 提示。
- 渲染基线检查保留原始角色图集哈希；本次可选消息绘制的差异独立登记。没有替换仓鼠身体或脚部图集。
- 浏览器姿态矩阵覆盖五只角色的动作起始 / 执行、7 档额度含未知、轻柔与动态、衣服和 440 / 300 / 190 / 180 像素。初次组合执行发现修仙 190 像素入口碰额度牌，已调整；修正后的海狸鼠 / 修仙矩阵 860 个采样通过，另三只的小尺寸玩法补测 216 个采样通过。原组合失败不记作整轮通过。
- 六只角色的共享消息流程复验通过：繁忙时入口、暂缓气泡、卡片计数、点击不拖窗、不取消动作、衣橱恢复、键盘、隐私、额度退出独立、消息来源切换清理。矩阵测试安装的模拟时钟会干扰后续计时流程，因此交互复验使用新浏览器会话。
- 肥嘟嘟喝茶、小恐龙喝茶、月汐唱歌在打开消息卡后保留动作。仓鼠 84 个实际跑动帧逐帧检查；手机 5 种骨骼动作 × 8 个进度边界检查一次绘制、不随取出 / 收起动画淡成不可见。
- 本轮未运行原生桌面窗口、真实咚咚新消息链路或 Windows；未构建发布包。

可复验脚本：`character-message-pose-qa.cjs`、`character-mail-frames-qa.cjs`、`character-message-flow-qa.cjs`、`character-message-focus-qa.cjs`。详见同目录 `checks.json`。

## 新物料来源

沿用 v4 的四只消息物料，只新增 `public/assets/feidudu/message-tag.png`。使用内置 image_gen 编辑，保留透明背景；生成原图保存在 Codex generated_images，项目副本纳入 native-assets 清单。

参考：`public/assets/feidudu/message-prop.png`。

完整提示词：

> Edit reference asset: isolate ONLY the small cream envelope charm with the glossy red heart seal and its little tan hanging loop. Remove the entire milk tea cup, straw and drink. Reconstruct complete envelope edges naturally. Match the reference's warm polished 3D clay material exactly. One centered envelope charm, front view slight tilt, large in square canvas, genuinely transparent background, no ground shadow, no text, no other objects. This will be composited onto an existing pet's original held cup so do not include a second cup.
