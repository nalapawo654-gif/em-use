# 仓鼠周边与互动道具图集

生成日期：2026-09-10。使用内置 `image_gen`，未使用 CLI/API fallback。

文件：`public/assets/hamster/props.png`。实际尺寸 1536 × 1024。

参考：项目 `仓鼠+修仙3.png` 和用户提供的原始「仓鼠动力机房」稿。参考稿包含监工猫、瓜子杯、蓝色发电机、小风扇、梳毛刷、铃铛、逗猫棒、咖啡、瓜子、枕头、木牌、电线。此次重建为独立物件，供运行时裁切与去色底。不是完整场景背景。

## 裁切与去底

生成图为 4 列 × 3 行。目视检查全部 12 件完整且互不重叠；**不要直接三等分高度**：猫箱底端到 y=350，越过理论第一行边界341。安全列带为 [0,384,768,1152,1536]；安全行带为 [0,370,680,1024]。也可使用下列实际物件边界并向四周扩展 3~6px。

背景接近品红但非严格常量，左上样本 RGB=(238,12,240)。应使用已有容差 chroma-key 清理，不可仅比较 #FF00FF。下列 bbox 为阈值 `r>175 && b>175 && g<100 && min(r,b)-g>90` 之外像素估算（右/下坐标不含）：

|序号|物件|left|top|right|bottom|
|---|---|---:|---:|---:|---:|
|1|安全帽监工猫与纸箱|27|24|359|350|
|2|瓜子杯（爪印）|470|88|727|317|
|3|蓝色发电机|845|16|1073|338|
|4|蓝色风扇|1220|28|1475|340|
|5|木柄梳毛刷|47|399|349|643|
|6|黄铜铃铛|495|388|694|646|
|7|蓝鱼逗猫棒|819|404|1107|653|
|8|咖啡杯|1243|405|1488|638|
|9|瓜子堆|36|762|363|941|
|10|蓝色枕头|431|717|725|968|
|11|空白木牌|828|692|1098|976|
|12|盘曲蓝电线|1195|729|1499|960|

无文字、无水印。猫黄色安全帽、杯子爪印、蓝色设备及相应互动道具均按原稿主题重建。生成图已通过原图目视检查；运行时去底、浏览器与原生效果由集成验收覆盖，本素材交付不代表这些层面已通过。

## 最终提示词

```text
Use case: stylized-concept.
Asset type: one production game prop sprite atlas for a tiny desktop hamster pet; ONE cohesive image, twelve isolated prop cells, not a poster.
Input images: first is style reference for golden-brown fluffy hamster world and individual props; second is source concept for cat supervisor, seed mug, and glowing generator. References only, do not reproduce composition or text.
Primary request: create a 1536x1024 image with exactly 4 equal columns and 3 equal rows, row-major order. Every cell approximately 384x341, each object fully contained and centered with at least 30px clear margin. No divider lines, no labels, no frames.
Background: perfectly flat solid chroma key magenta #FF00FF across all empty pixels. NO checkerboard, NO room, NO scene backdrop, NO gradient, NO floor, NO cast shadows on backdrop, NO pink glow or color spill on objects. Single isolated complete object group per cell.
Twelve cells in exact left-to-right top-to-bottom order:
Row1 col1: adorable stocky tabby cat supervisor wearing a yellow construction safety helmet, leaning both paws over the open rim of a worn tan cardboard box. All contained as one object group, no writing on helmet or box.
Row1 col2: white ceramic mug filled with sunflower seeds, a simple black paw-print emblem on the mug front, no letters.
Row1 col3: compact little blue metal cylindrical AI power generator with luminous cyan glass chamber, dark blue housing, gold/brass fasteners, no text, no cables stretching outside its cell.
Row1 col4: small vintage desktop fan, teal blue metal cage and four blue blades, short stand with brass foot.
Row2 col1: pet grooming brush with short honey-colored wooden handle and dense soft tan bristles, diagonally placed.
Row2 col2: shiny brass hand bell, clear little handle, slight three-quarter angle.
Row2 col3: cute blue fish-shaped cat teasing toy attached by short cord to a short wooden handle; complete compact object diagonally arranged.
Row2 col4: white ceramic mug with dark brown coffee inside, simple warm edge, no letters.
Row3 col1: little pile of striped sunflower seeds, about ten seeds, no container.
Row3 col2: a single plump pale blue square miniature pillow with subtly stitched corners.
Row3 col3: a small blank warm wood signboard with a short wooden post and small foot support, front blank light wood face with room for UI text overlay.
Row3 col4: one small coil of rich blue power cable with a small copper plug, isolated compact complete object.

Style: the references' polished fine soft 3D illustrated game objects, cozy warm amber lighting with detailed plush fur on cat, convincing wood/brass/ceramic textures, appealing rounded silhouettes, camera three-quarter frontal view. Match golden hamster reference, not flat icon/vector. Preserve legibility at small scale. No people, no hamster characters, no scenery, no watermark, no text anywhere. All 12 cells equally sized and strictly in position.
```
