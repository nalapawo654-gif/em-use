# 充气牛马翻页日历物料制作记录

- 日期：2026-09-15
- 选定方案：`03-grass-flip-calendar.png` 中的暖木翻页日历，独立物料化。
- 工具：内置 image_gen，未使用 CLI/API，未使用代码进行图像编辑。
- 最终文件：`public/assets/buddy/calendar-stand.png`
- 尺寸：1254 × 1254 px；RGB PNG，无 alpha。背景为 image_gen 输出的纯绿视觉底色（以 #00FF00 为目标），接入时需运行时去绿或后续专门获得真正透明导出。不能作为已透明图片直接绘制。
- 初次透明请求输出了烘焙棋盘背景，已弃用该版本作为交付物，二次编辑仅替换背景。
- 视觉验收：完整单个 A-frame，暖木纹理、两枚黄铜环、奶油纸、蓝皮革底条与两枚铆钉；无角色、文字、草地、额外物体。轻微右侧三分之四视角，纸面留白。
- 纸面四角近似归一化坐标（相对于整个 1254 正方形）：左上 (0.265, 0.185)、右上 (0.715, 0.198)、右下 (0.665, 0.699)、左下 (0.159, 0.651)。上部铜环占用纸面，动态内容建议避开 y < 0.30。
- 推荐动态图标和时间安全范围：x 0.28–0.64，y 0.34–0.64；视觉中心约 (0.46, 0.49)。纸面上沿从左向右轻微向下，文字可旋转约 4 度；如需严格贴合可使用四边形变换。
- 物体近似外接框：x 0.08–0.93，y 0.075–0.89。保留 padding，请绘制时按该范围计算命中区域，避免透明边缘抢占现有手势。
- 本物料没有覆盖或修改原有 props.webp；没有运行浏览器，场景融入及所有交互状态由主任务验收。

## 首轮提示词

```text
Use case: stylized-concept.
Asset type: single production-ready isolated game prop for the desktop pet in reference image 1.
Input images: Image 1 is the selected visual design, its lower-left front-view calendar is the exact object to recreate. Image 2 is the existing game prop material/style reference only.
Primary request: Render ONE exquisite miniature wooden A-frame flip calendar, matching the lower-left FRONT calendar in reference 1. Warm honey wood A-frame with subtle handworked grain and rounded bevels, two polished brass binder rings at its top, a stack of thick cream paper, and a royal/cobalt blue leather strip at bottom with fine stitching and two little brass rivets. The paper face must be completely BLANK: NO icon, NO letters, NO numbers. Leave the entire cream paper middle clear so software can render live calendar icon and meeting time. Mild three-quarter view, nearly frontal, slightly looking down, tiny right side of A-frame visible, straight-on readable paper. Full object centered with 8 percent transparent padding, fills most of square canvas; keep all edges and both feet inside frame. Lighting warm soft from upper left, highly polished cozy 3D cartoon game prop, same glossy hand-crafted wood/brass/leather realism as references.
Scene/backdrop: genuinely TRANSPARENT background with actual PNG alpha channel. Transparent pixels everywhere outside object and between A-frame supports. No opaque background, no checkerboard pattern, no floor or environment. Very minimal contact shadow only beneath feet if it retains alpha.
Constraints: ONE calendar only, no pet, no cow/horse, no grass, no speech bubble, no text, no clock, no extra objects, no logo, no watermark. Preserve accurate A-frame construction and two brass rings. High-quality anti-aliased cutout.
```

## 第二轮背景编辑提示词

```text
Use case: precise-object-edit / background-extraction.
Edit ONLY the background of the attached calendar prop. Keep the entire wooden A-frame calendar EXACTLY unchanged: same geometry, size, placement, paper, brass rings, blue leather, lighting, textures, every detail. Replace every gray/white checkerboard pixel and every outside background mark with a flat absolutely uniform chroma key GREEN background RGB(0,255,0), hex #00FF00. Make the background fully solid flat pure green, no gradient, no shadows, no checkerboard, no texture, no highlights. Background gaps inside rings and between the support legs must also be pure green wherever background is visible. Do not put green on the prop itself or add green lighting spill. Keep blank cream paper unchanged. Same square framing. No text, no additional objects.
```
