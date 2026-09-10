# 2026-09-10 一体穿戴修复

工具：内置 `image_gen`。原图保留在生成目录，选用 PNG 复制到本目录。旧独立帽子、衣物图集不再用于角色渲染。

## 素材与绑定

- `dressed-bodies.png`：3×2，依次为晴天裸躯干、穿雨衣躯干、红围巾躯干、橙围巾躯干、背心躯干、备用裸躯干。衣服、皮毛与接触阴影在同一贴图内，随骨盆呼吸和额度姿态一起变换。
- `dressed-heads-{sunny,rain,snow,wind,night}.png`：每套 3×2 六档表情。帽子与头型、耳朵、接触阴影一起绘制，保留嘴、汗滴和表情；固定画格绑定共享头部变换，不再叠加浮帽。
- `dressed-rest.png`：3×2，前五格是五套一体穿戴趴姿，末格备用裸趴姿。休息时整帧呼吸，不复用站姿外套。
- 衣橱缩略图与角色使用同一套穿戴头部素材。

## 躯干生成提示

Create a production game sprite atlas 1536x1024, strict 3 columns x 2 rows, every cell 512 square. The edit target is the HEADLESS ARMLESS seated beaver TORSO at TOP LEFT of first reference. Produce SIX copies of precisely this torso shape, same 3/4 RIGHT-facing view, furry pear body, haunches and two feet, exact warm orange fur, lighting. Each copy centered within its cell, feet at y465 within cell, 40px margin, body extending up to y65, consistent identical scale. PURE WHITE background, no contact shadows on white. NO heads, faces, hats, forearms, hands or tails. CLOTHES MUST BE WORN ON THE ACTUAL BODY, seamlessly integrated and form-fitting with contact shadows, compressed fur around collars, realistic curved hems, never floating hollow clothing. TOP LEFT bare torso unchanged. TOP MIDDLE torso wearing golden yellow sleeveless raincoat tightly fitted to round belly, closed side shoulder with small fur-filled arm root at upper right front for separate animated forearm, no visible empty armhole, neck at upper right. TOP RIGHT bare torso with thick red knitted scarf snugly around UPPER neck, short tails hugging front right chest, no loose floating collar. BOTTOM LEFT torso with rust orange scarf in same placement. BOTTOM MIDDLE torso wearing tailored navy camping vest, closed side shoulder and small fur-filled arm root upper right front, round belly and lower haunches showing, no empty armhole. BOTTOM RIGHT bare torso unchanged. Use second reference only for fabrics and colors; do NOT copy its floating garment shapes or empty armholes. Preserve original anatomy and furry silhouette as closely as possible. Atlas is rig parts, NEVER full characters, and no text or grid.

参考：`rig.png`、`fitted-clothes.png`。

## 趴姿生成提示

Create production 1536x1024 game sprite atlas strict 3 columns x 2 rows, six 512x512 cells. Edit target: ONLY sleeping beaver at bottom RIGHT of first reference. Duplicate that exact sleeping pose, same anatomy, orange fur, brown paddle tail on left, head low on right resting on hands, eyes shut, two teeth. FULL character in every cell consistently aligned and scaled to 450px wide max, centered x256, bottom y458 and full silhouette including hats stays within cell with at least 24px whitespace. Pure white background, NO ground shadow. Make wardrobe genuinely worn and integrated into anatomy, natural contact shadows, compressed fur, perspective matching the prone sleeping pose. Top left: snug straw hat green ribbon. Top middle: snug yellow rain hat AND yellow raincoat curving horizontally along its rounded back, open face and hands visible, no empty neck/arm holes. Top right: red/cream pompom beanie fitted over crown behind ears AND red scarf wrapped around neck BEHIND cheeks with tails lying on chest/floor, never on face. Bottom left: brown leather goggles aviator cap over crown AND rust orange scarf around neck behind cheeks. Bottom middle: navy headlamp cap AND navy vest curving horizontally around back and belly, open face, no empty holes. Bottom right: bare original sleeping beaver. Second reference for clothing STYLE ONLY, do not use seated pose. Hats must surround crown with fur overlapping at ear edges, not perched on forehead. Clothes follow prone body contours, NOT upright jackets pasted onto back. Keep same character face, no text, no grid, no extra props.

参考：`states.png`、`output/playwright/beaver-fit-five.png`。

## 五套头部生成提示

以下提示分别替换 `{hat}` 调用一次；参考 `quota-heads.png`。

- sunny: a straw hat with green ribbon
- rain: a golden yellow soft rain bucket hat
- snow: a red and cream knitted pompom beanie
- wind: a brown leather aviator cap with brass goggles resting on crown
- night: a navy blue camping cap with a small round warm headlamp

Precisely edit this game sprite atlas. Keep strict 1536x1024 output, 3 columns x 2 rows of exactly 512x512 cells, one head centered in each. Keep all SIX beaver heads and their individual expressions, muzzle proportions, orange fur, right-facing 3/4 angle, whiskers, teeth, consistent original head size and positions. Add {hat} naturally WORN on EVERY head. Remove all blue sweat headbands but preserve sweat drops and exhausted expressions in bottom row. Hat MUST wrap closely around crown, not perch or float, with correct contact shadow on fur, ears sticking naturally in front of hat edge, fitted lower band hugging skull. All hats and all whiskers MUST fit inside their individual 512px cell; head scale MUST be identical across all six cells, heads slightly lowered together ONLY if needed for hats fitting. Leave at least 16px white gutter at each cell border. Preserve original facial expressions precisely: top left joyful open mouth; top middle relaxed closed smile eyes; top right effort half-open eyes; bottom left fatigued worried eyes/sweat; bottom middle nearly asleep/sweat; bottom right eyes closed exhausted. ONLY heads with integrated hats, NO body or neck clothes, no background shadows, no grid or labels. PURE WHITE background. Detailed warm stylized 3D game fur and material rendering matching input. This is one coherent dressed head per cell, never separate floating hat overlays.
