# 肥嘟嘟 · 角色方案与验收

参考：仓库根目录 `肥嘟嘟.png`。遵守 [桌宠基础交互规范](../../docs/desktop-pet-interaction-standard.md)。正式接入 Rust / Tauri 客户端；根目录 Electron 为历史对照，不增加新功能。

## 外观与额度

透明背景、黄色软陶质感、双长耳、大棕鼻、奶油肚皮。独立九宫格角色素材，真实额度、台词和工具由界面渲染。默认原味黄；另有蜜桃粉、奶油黄、小黑紫、饿了么蓝和狗东红五种本机独立配色，保存在 `feiduduSkin`。日夜共用透明角色，夜晚降低亮度、采用深色提示面板；轻柔模式保留姿态结果、停用呼吸和摇摆。

| 剩余额度 | 形态 | 台词 |
| --- | --- | --- |
| > 80% | 元气坐姿 | 上班很苦，但我很圆。 |
| > 60% | 捧奶茶 | 摸鱼也很费力！ |
| > 20% | 靠抱枕 | 问题不大，我还能扛！ |
| > 15% | 趴下 | 再坚持一下… |
| ≤ 15% | 趴成饼 | 我躺平了… |
| 未知 / 非有限数 | 中性坐姿、额度 — | 不管电量多少，我都陪着你。 |

保留 stale、未登录、连接中、过期、跨日、不可用、无权限各自语义。动作不写额度，结束后根据最新共享额度恢复。

## 专属互动

常用入口为悬停工具；全部动作也在顶部玩法按钮、场景右键及浏览器演示区可达。不采用双击，不占用拖动玩法，不设无意义进度条。拖动主体沿用共享 5 px 拖窗阈值与 400 ms 点击抑制。

| 动作 | 入口 / 手势 | 反馈与道具 | 完成 / 取消 / 重入 |
| --- | --- | --- | --- |
| 摸摸头 | 主体轻点、玩法按钮 | 侧身挥手、爱心、轻摇 | 2.4 秒回日常 |
| 请喝奶茶 | 常用 / 玩法点击 | 奶茶与吸管、小幅啜饮 | 4.5 秒回日常 |
| 投喂饼干 | 常用 / 玩法点击 | 捧饼干、咀嚼晃动 | 4 秒回日常 |
| 摸摸肚子 | 常用 / 玩法点击 | 翻身露肚、眯眼、爱心 | 3.6 秒回日常 |
| 陪你加班 | 常用 / 玩法点击 | 电脑、红发带、轻微敲键 | 持续；“结束陪伴”或 Esc 恢复 |
| 圆滚滚摇摆 | 玩法点击 | 开心侧身、有节奏左右摆动 | 3 秒回日常 |
| 一起躺平 | 玩法点击 | 趴下休息、睡眠提示 | 持续；“起床”或主体轻点 / Esc 恢复 |

所有动作有结束按钮，重新进入会从头播放，新动作替换旧动作；面板互斥。Esc 在容器内关闭面板并取消动作。切场景 / 失焦清理短动作，页面隐藏暂停 CSS 动画、清理短动作，组件卸载停止计时器。

## 验证记录

实施完成后补充源码 / 测试、浏览器预览、macOS 原生、Windows 原生、真实账户各层证据；不以浏览器模拟代替原生系统能力。

## 2026-09-12 实施结果

新增 `FeiduduExperience`、`FeiduduVisual`、`FeiduduWardrobe` 和 `src/feidudu/` 状态 / 素材模块。场景 ID 为 `feidudu`，配色字段为 `feiduduSkin`。接入 App 标题与场景、浏览器选择器、设置独立衣橱和 Rust 托盘；通过共享设置校验生成 Rust contract，旧设置默认原味黄。不复制账户、额度或窗口手势服务；面板和动作提示通过现有 `data-pet-gesture` 排除拖窗。

素材最终保存在 `public/assets/feidudu/atlas.png`，使用内置 **image_gen** 生成与修正，未使用 CLI / API Key。源图为洋红抠色底，运行时复用项目的抠色思路生成透明 Canvas，不能把源 PNG 当作已经有 alpha 的素材。按九个独立裁切范围提取并统一基线；不会按规则九宫格裁断脚或压扁角色。蜜桃粉与奶油黄为显示配色，画面道具也随配色调整。

`docs/native-assets.json` 登记新增 Tauri 素材的尺寸、字节数和 SHA-256。原有 56 张素材继续由 `asset-compression.json` 逐像素对照；Tauri 新功能所需的 App、ScenePicker、main 和设置校验列为迁移后接入差异，76 份既有渲染 / 动作 / 手势文件仍与 Electron 基线比对。Electron 历史项目不增加该场景。

### 源码与测试

- `npm test`：90 项 TypeScript 测试 + 5 项发布脚本测试通过。新增 5 项肥嘟嘟测试覆盖额度分界、短动作结束、持续姿态取消、动作替换、额度不变、旧设置兼容、配色校验和抠色保色。
- `npm run build`：设置 contract、类型检查、Vite 构建通过；主 JS 包有 Vite 大于 500 kB 的体积提示，无构建错误。
- `npm run verify:parity`：76 份既有渲染 / 动作 / 手势文件、56 张既有素材和 1 张新素材哈希通过。
- `scripts/optimize-assets.py --check`：56 张既有素材的尺寸和每个 RGBA 像素一致；新素材哈希和 1254 × 1254 尺寸通过。
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：17 项通过，真实咚咚账户测试 1 项按既有约定忽略。
- `git diff --check`：通过。

### 浏览器与模拟桥接

Chrome + Playwright，预览页及 `tests/fixtures/feidudu-native.html`：

- 初始隐藏、移入显示、面板保持、点击关闭再移出隐藏、键盘焦点显示；三类面板互斥，容器 Esc 关闭面板并取消动作；动作 / 面板中隐藏缩放角。
- 七种动作的实际渲染帧、短动作定时结束与持续姿态退出通过；动作前后模拟额度不变。状态时长批量验证使用虚拟时钟，另以真实 2.7 秒等待验证主体轻点自动恢复。
- 五档额度、六种不可用状态的 `—`、stale 的待更新提示通过。
- 模拟桥接观察到共享拖动调用；5 px 以上拖动没有顺带摸头，之后独立轻点正常触发。**这不证明 OS 窗口真实移动。**
- 440 / 300 / 190 / 180 px 检查；玩法面板可滚动，关闭、持续姿态恢复、设置入口可用。
- 预览配色实际写入 localStorage，刷新及切换桌宠保留；设置中显示肥嘟嘟独立衣橱。
- 白天 / 夜晚、轻柔模式通过。全九帧 × 三配色及深色背景逐张目视检查，36 张 Canvas 均加载；每张残余高饱和洋红像素为 0，画布外缘 10 px 无不透明角色像素。此检测只覆盖指定阈值，边缘质量另由截图目视检查。
- 素材与组件无加载错误；普通预览仍有既有 `/favicon.ico` 404，不影响角色运行。

截图保存在仓库根目录 `output/playwright/`：`feidudu-final-preview.png`、`feidudu-hero.png`、`feidudu-all-frames.png`、`feidudu-standard.png`、`feidudu-night.png`、`feidudu-panel-300.png`、`feidudu-panel-190.png`、`feidudu-panel-180.png`。逐帧入口为 `tests/fixtures/feidudu-frames.html`。

### 尚未验证的层面

本次未运行真实 macOS / Windows 新场景窗口，不宣称透明窗口、OS 拖动 / 四角缩放 / 跨屏约束、托盘恢复、穿透恢复及重启持久化已通过。未登录真实账户验证肥嘟嘟额度；未构建或发布安装包。

## 素材生成提示词

初始生成基于用户的 `肥嘟嘟.png`，目标是同一角色的九个完整姿态：元气坐姿、奶茶、抱枕、趴下、趴平、饼干、加班电脑、仰躺肚皮、侧身挥手。要求黄色软陶、双长耳、棕鼻、奶油肚皮、同一视角和完整肢体，不生成页面、文字、进度条或人手。首次输出含棋盘底，透明修正出现杂边，两版均未作为运行素材。

最终采用的背景修正提示词（内置 image_gen，输入为初始九姿态图）：

> Edit target: the supplied nine-pose yellow chubby character sprite atlas. Replace ONLY the entire gray checkerboard with one perfectly solid pure vivid MAGENTA #FF00FF background. Opaque RGB, NOT alpha transparency. Absolutely flat magenta background, no checkerboard, no gray, no gradients, no shadows, no stray particles. Preserve all nine yellow characters and their objects exactly, including their pose, size, positions, colors, soft clay shading, and proportions. Clean sharp antialiased silhouette edges against magenta; no fringe or halos. No changes to any character, NO rearranging. This is a chroma-key game sprite atlas, intended for runtime color-key transparency. The full canvas background between all sprites must be pure #FF00FF.


## 2026-09-12 追加三款配色

按用户指定名称新增「小黑紫」「饿了么蓝」「狗东红」，ID 分别为 `black-purple`、`eleme-blue`、`jd-red`。仍通过 `feiduduSkin` 和共享设置校验保存，Rust 设置 contract 同步更新，现有默认值和三款旧配色保持兼容。

新皮肤使用 `src/feidudu/skins.ts` 对角色黄色区域进行 HSV 换色，以原始亮度保留立体明暗，淡化肚皮染色，保留眼睛、棕鼻和非黄色道具。透明度和九帧裁切不变，不增加位图包体；原来的蜜桃粉、奶油黄继续使用原有显示滤镜。

验证：前端构建、91 项 TypeScript 测试和 5 项脚本测试通过；新增像素测试检查三种主色、透明度、眼睛 / 鼻子 / 抱枕 / 电脑颜色不变和原味黄不处理。浏览器逐帧页扩充至六皮肤 × 九帧，加九张深色底样本，共 63 张实际组件全部加载。新三款均通过预览实际选择、刷新恢复、切换桌宠后恢复和额度不变检查。六款衣橱支持昼夜与滚动布局。此次未增加原生桌面或真实账户验收结论。

截图：`output/playwright/feidudu-six-skins.png`、`feidudu-wardrobe-six.png`、`feidudu-wardrobe-six-night.png`（相对仓库根目录）。

## 随机日常小动作（2026-09-12）

新增九种日常动作：眼珠滴溜溜、抖耳朵、自己揉肚子、打哈欠、双眨眼、困倦点头、伸懒腰、晃小脚、鼻子嗅嗅。眼睛使用局部眼白 / 瞳孔 / 眼睑绘制，耳朵、手臂、脚和鼻子使用源图坐标绑定的局部形变；不增加整张图的固定摇摆来代替这些动作。皮肤染色在准备画面时缓存，局部动作最多 30 fps，动作间隔不运行 RAF。

首次进入等待 3–8 秒，之后每次动作结束随机等待 5–13 秒；独立随机选择动作、速度与视线方向，不连续重复同一动作。只在日常状态运行，不增加常驻按钮、提示或反复播报的无障碍消息。坐姿支持九种动作，喝奶茶时需要空手的动作短暂过渡到坐姿，之后拿回奶茶；低额度趴姿只运行安静的眼睛、耳朵、鼻子、哈欠和点头，耗尽姿态不会伸懒腰或坐起。真实额度、台词与账户状态不受影响。

打开面板、拖窗、手动互动、页面隐藏、轻柔模式或系统减少动态效果时取消日常动作及等待计时器。恢复后重新随机等待，不补播积压动作；换姿势 / 皮肤重建对应素材，卸载取消 RAF、计时器与媒体查询监听。手动动作仍使用原有独立结束与取消规则。

验证边界：

- 源码 / 测试：`npm run build`、94 项 TypeScript 测试、5 项发布脚本测试、`verify:parity` 和 `git diff --check` 通过。此次仅修改前端动作，无新增 Rust 行为。
- 浏览器：专用 `tests/fixtures/feidudu-motion.html` 对五个日常姿态的 37 种动作组合、六套皮肤、七个时间采样点做像素检查（共 1554 个样本）；444 个起止画面与各自原始姿势逐像素一致，所有采样没有越过画布 10 px 安全边界。另查看了局部动作联系表。原味 / 紫色的画面检查覆盖眼睛、闭眼哈欠与透明边缘；这不等于逐帧人工检查全部样本。
- 浏览器调度：模拟时间推进确认随机选择、不连续重复、打开面板与手动互动让位、短动作结束恢复、应用与系统轻柔模式、隐藏 / 恢复。模拟账户额度维持不变，未发出额度或偏好写入调用。浏览器 CPU 上揉肚子单帧约 0.6–0.9 ms，仅为本机抽样，不是原生性能结论。
- macOS 原生：已在运行中的 `EM Use Dev.app` 热更新，并通过原生截图检查正常显示及视线变化；客户端保留真实额度。没有完成每个随机动作 / 每套皮肤的原生全量验收。Windows 未验证；未新增真实账户接口验证。
