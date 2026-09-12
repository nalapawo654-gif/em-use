# 小恐龙素材记录

使用内置 `image_gen`，参考用户提供的 `../../小恐龙.png`。运行素材保存于 `../public/assets/dinosaur/atlas.png`，1254 × 1254，九种独立姿态；完整性校验见 `native-assets.json`。

第一次输出是无 alpha 的棋盘背景，未作为运行素材。第二次只将背景改为纯洋红并移除电脑标志；运行时通过 `src/dinosaur/sprites.ts` 抠色、边缘去溢色并按实际边界取帧。各帧等比归一化到共同基线，保持低额度趴姿的自然高度，不拉伸填满方格。绿色身体在 Canvas 中局部换色，保留原图非绿色区域和 alpha。

## 首次生成提示词

```text
Use case: stylized-concept.
Asset type: production transparent sprite atlas for a desktop dinosaur pet, NOT a poster or interface.
Input image is a CHARACTER AND MATERIAL REFERENCE only. Create one precise 3 by 3 atlas of NINE independent full-body poses of the SAME cute mint-green baby dinosaur: huge rounded head, shiny dark eyes, tiny stubby arms, exactly TWO feet, cream belly and muzzle, little golden orange dorsal spikes, thick curved tail, blush cheeks. Soft tactile 3D clay toy, lovely rich shaded sculpted volume, studio light upper left. Match the friendly dinosaur in the reference.
Canvas square 1536x1536, nine equal 512x512 cells, no visible grid. Each dinosaur wholly INSIDE its cell with at least 35px clear margin. Character faces viewer slightly toward right, consistent proportions and light; no cropping. Baseline aligned near cell bottom, all poses similar scale (standing poses ~420px tall, lying poses shorter naturally).
Read order:
row1 col1: happy energetic standing, eyes wide open, tiny arms welcoming, both feet visible, no props.
row1 col2: seated contentedly holding ONE bubble milk tea with red straw at mouth, eyes happily half closed.
row1 col3: sleepy dinosaur sprawled on a small warm orange oval cushion, eyelids drooped.
row2 col1: very tired lying flat on belly, chin on ground, half closed eyes, tail extends beside body, no cushion.
row2 col2: completely exhausted, lying pancake flat, small cartoon X closed eyes, cute and harmless, no floating ghost, no scribbles.
row2 col3: seated holding a single bitten golden cookie with BOTH small hands near mouth, happy.
row3 col1: seated at a tiny grey open laptop, tiny hands at keyboard, attentive sleepy face, laptop low enough to show face.
row3 col2: curled up fully asleep under a small periwinkle blue blanket, head and back spikes visible, eyes closed.
row3 col3: delighted by a head pat, eyes smiling closed, head gently tilted, both hands raised beside cheeks, seated with TWO feet visible, NO human hand, no hearts.
Background: true alpha transparency throughout outside each character/prop. NO white backdrop, NO checkerboard drawn in, NO ground plane, NO broad cast shadows. No lettering, labels, typography, badges, speech bubbles, symbols, UI or watermarks. Clear separation between all nine cells. Produce only the atlas.
```

## 最终修正提示词

```text
Edit target: this nine-pose dinosaur sprite atlas. Change ONLY the background: remove the gray checkerboard and replace it with exact flat solid saturated MAGENTA #ff00ff chroma background. Every single background pixel must be this flat magenta color, no gradients, no checker pattern, no ground shadows. Keep ALL nine dinosaur poses and their props, face details, lighting, size and coordinates unchanged, no additions. Keep square canvas and complete silhouettes with space between poses. Also remove the little white logo on the laptop lid, leaving the laptop lid plain grey. Preserve dinosaur green, cream belly, orange spikes, grey feet and blue blanket exactly. Output only the sprite atlas, no text.
```
