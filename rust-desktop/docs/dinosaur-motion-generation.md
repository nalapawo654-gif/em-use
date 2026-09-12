# 小恐龙日常动画素材

使用内置 `image_gen`；参考已有 `public/assets/dinosaur/atlas.png`，新增素材保存为 `public/assets/dinosaur/motion-rig.png`（1254 × 1254），原始图集保留。哈希与文件字节记录在 `native-assets.json`。

七个实际运行图层为身体、头、左手、右手、左翅膀、右翅膀、手机；第三个素材格包含两只分别提取的手，因此六格对应七层。身体严格只有两脚，手不烘焙在身体上；Canvas 按翼根/肩/颈关节组合，避免重复肢体。沿用角色色键边缘处理，身体部分局部换色，翼羽和手机保持原色。

## 内置工具提示词

```text
Create a 3-column by 2-row production animation parts atlas. Reference image shows the exact mint-green baby dinosaur identity and soft shaded 3D clay toy material to preserve. NOT a poster. Flat solid pure magenta #ff00ff background, no shadows on background, no grid drawn, no text. All parts completely separated inside their equal cells with generous margins. Square canvas. Six cells in reading order:
1 TOP LEFT: ONLY the dinosaur's seated torso from neck down, creamy oval belly, exactly two stubby feet with grey soles, green curved tail and orange back spikes. NO HEAD and NO ARMS. Whole body fully visible. Neck top smooth rounded connection. Front three-quarter view, facing slightly toward viewer's right, matching reference.
2 TOP CENTER: ONLY its detached big cute head, smooth rounded mint green, shiny dark large eyes OPEN, small closed smiling mouth, peach blush and cream lower muzzle, small crest. No body or limbs. Front three-quarter, looking slightly right, same lighting as torso. Head attachment underside rounded. No protruding long neck.
3 TOP RIGHT: TWO separate stubby GREEN ARMS, each in a different half of the cell, not touching: left arm on left with rounded shoulder at upper left and three tiny rounded fingers at lower right, right arm on right with shoulder upper right and fingers lower left. Front-facing upper surfaces, palms curling gently to hold a phone. No separate detached fingers. These are puppet arms to attach at their shoulder ends.
4 BOTTOM LEFT: ONE left-facing cream-white baby dragon feather wing, small and chunky, sculpted soft 3D clay, base/root on RIGHT LOWER side, feather tips extend LEFT and UP. Entire wing with three broad layered feathers and gentle cream shadows. No dinosaur attached.
5 BOTTOM CENTER: ONE mirrored right-facing cream-white baby dragon feather wing, root on LEFT LOWER side, feather tips extend RIGHT and UP. Same shape scale lighting/material as cell4.
6 BOTTOM RIGHT: ONE small dark blue rounded-corner smartphone, FRONT SCREEN FACING VIEWER, near-front view. Light pale blue illuminated blank screen with 3 colorful rounded picture blocks, no letters/numbers/logos, little black speaker slit. No hand. Tall portrait orientation.
Each object fully inside its own cell. No duplication of full dinosaurs. Detached parts are clean game-art layers designed to be reassembled into one dinosaur with exactly two arms, two feet, one head, and two optional wings. Consistent warm upper-left studio lighting, rich 3D rounded volume, no hard outlines, high quality matching reference.
```
