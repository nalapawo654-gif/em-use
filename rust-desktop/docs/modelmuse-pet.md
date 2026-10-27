# 额度变装小人

用户批准的四形态桌宠，名称借用模型拟人梗，不代表真实模型切换或能力排序。阈值为 Claude >80%、GPT >60%、Gemini >40%、豆包 ≤40%；未知额度独立等待，零额属于豆包。仅在真实来源数据刷新后切换，回升使用相同规则。Codex 采用所选额度分组内剩余比例最低的有效窗口，其他窗口仍独立展示。`stale` 显示待更新，不把未知伪装成零额。数据由既有共享账户和额度桥接提供，所有互动不修改真实额度。

豆包的流口水为固定外观。各档均有打招呼、整理行头、抽状态签和日常闲聊；点击主体或使用环抱操作带触发，短动作自动结束。面板互斥，可用 Esc 退出；截图走共享接口。角色形象在操作期间暂缓切换，最新额度仍即时显示，操作结束采用最新目标；未知立即切换为等待态。浏览器演示数据只用于外观预览。

台词是基于网上常见拟人印象的原创娱乐文字，不是模型真实回复。参考：[“豆包型人格”网络热梗](https://dzb.henandaily.cn/html5/2026-05/08/content_18_1791851.htm)、[关于模型回答风格的用户讨论](https://blog.rezvov.com/opus-gemini-chatgpt-walk-into-a-bar)、[模型口癖的趣味归纳](https://www.birdmanoutman.com/zh/blog/2026-09-04-ai-cliches-by-model)。

角色图由 imagegen 根据用户提供的参考及其确认的四形态概念图生成。已接入四档 Codex 觉醒服装、整理及展示姿态，换源使用共享状态机编排准备、换装、展示和收束。原生桌面与真实账户尚未验证，不能以浏览器预览替代。

## 素材生成记录

采用内置 imagegen，用户提供的四张参考与已确认四形态概念图作为视觉依据；资源位于 `public/assets/modelmuse/`。使用以下提示词模板并按四档逐一指定角色（生成图用于界面素材，非真实模型肖像）：

- 常态：`Asset type: production desktop pet full-body transparent character sprite. Use the supplied complete four-form concept sheet as the authoritative visual reference. Isolate and faithfully recreate only [character]. Same face, rendering, clothing, proportions, silhouette, materials, and charming highly detailed 2.5D chibi look. Full body head to toe centered, one character only, transparent background with real alpha, no text.`
- 整理：`Edit the supplied single character into a second action pose: [pose]. Keep the same face, hair color and style, costume, accessories, body proportions, overall silhouette, rendering style, lighting and colors. Preserve the complete head and both feet, at the same scale and position, transparent alpha. Make the limb and expression change visible.`
- 觉醒：`Edit the supplied character to wear [outfit]. She is the exact same character. Show a new complete fitted outfit and real changed clothing silhouette, not a glowing overlay. Preserve face identity, proportions, recognizable accessories, color palette and high-quality 2.5D chibi rendering. Head to toe centered, transparent alpha.`
- 觉醒整理：`In the supplied image the same character [pose]. Preserve exactly her awakening costume, details, outfit silhouette, face, hair, body proportions, colors and 2.5D chibi style. Pose change must be evident. Keep the same scale and center, whole body, transparent alpha.`

四档动作依次为整理向日葵发饰、数小钱袋、整理星星发卡、整理红围巾。豆包常态和动作均要求 `a clearly visible long thin strand of drool hanging from the mouth over the red scarf`。

- 觉醒展示：`The exact character in the supplied reference [pose]. Preserve her awakened costume in full, face, hair, proportions, color palette and chibi style. Show a visible pose change; whole body, matching the reference scale and centered placement, transparent alpha.`

## 本次验证

- `npm test`：应用测试 243 项及脚本测试 13 项通过；`npm run build` 通过。
- 新增 20 张 PNG 与日历 SVG 的清单、哈希、尺寸以及 PNG 透明通道已单独核对。
- 浏览器演示中检查四档及 80%、60%、40% 分界、豆包点击和整理姿态、Codex 双窗口展示与觉醒装扮；演示数据不是真实账户。未完成原生窗口、跨平台与真实账户验收。
- 全量 `optimize-assets.py --check` 因工作区已有的四个寄居蟹资源未在清单登记而失败；这四个文件未在本次工作中改动或清理。
