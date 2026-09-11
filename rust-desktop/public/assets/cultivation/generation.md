# 修仙桌宠素材

2026-09-10，使用内置 image_gen 工具生成。参考用户提供的修仙海报风格，素材独立生成，图上文字和额度由 Vue 实时渲染。

- `cultivator.png`：2 × 2 透明角色图集，顺序为充足、调息、低额、零额。原图保持透明 alpha，不进行抠图或破坏性处理。
- `props.png`：3 × 3 透明道具图集，顺序为仙山、仙鹤、香炉、茶杯、木鱼、符咒、玉梳、仙桃、荷叶伞。
- 组件通过 CSS 图集窗口选择素材；素材保存在项目中，不依赖生成目录。

## 角色提示词

Use case: stylized-concept. Asset type: production transparent sprite atlas for a Chinese xianxia desktop pet. Reference: the user supplied poster of a cute white-robed meditating cultivator on a floating island, used ONLY as artistic reference. Create a NEW meticulously painted 2 by 2 sprite atlas, four equal square cells, 1536x1536 total. True transparent alpha background, no labels, no text, no borders. SAME adorable chibi young adult male Chinese immortal in each cell: huge head, long black hair, high bun with gold hairpin, expressive brows, creamy white hanfu with sky-blue lapels and sash, tiny gold waist ornament, seated cross legged, two hands held out in meditation, bare feet tucked in robe. Rich illustrated game-art texture, soft clean edge, warm light, matching reference's hand painted premium fairy-tale aesthetic. Top left: peaceful happy closed eyes, upright meditation, full vitality. Top right: slightly tired closed eyes, drooping shoulders, one tiny sweat bead. Bottom left: exhausted, slumped but still cross legged, worried drooping eyes, dishevelled hair. Bottom right: comically charred soot face, messy hair, round startled eyes, white robe lightly soot marked, still seated, humorous exhaustion no injury. Character only, no island, no aura or particles (these are separate runtime layers), no sky, no scenery. Every complete figure centered with identical scale and baseline in its own cell and generous 10% transparent padding, no overlapping cells. Save production atlas to workspace if tool supports file output.

## 道具提示词（成功版本）

Create a transparent PNG sprite sheet, 3 by 3 equal cells. Hand painted cute Chinese xianxia game art, cream jade gold palette, no text, no borders. Nine separate objects, one centered in each cell with generous padding: top row: floating mossy rocky island with flat top and tapered roots, red crowned white crane, ornate bronze incense burner; middle row: celadon tea cup, wooden fish percussion instrument with mallet, golden paper talisman; bottom row: blue jade comb, pink longevity peach, green lotus leaf umbrella. Actual transparent background. All objects fully visible and within their individual square cells. No people, no scene background.

较长的道具提示词生成两次遇到网络错误；以上精简提示词重试成功。未使用 CLI / API Key 降级。
