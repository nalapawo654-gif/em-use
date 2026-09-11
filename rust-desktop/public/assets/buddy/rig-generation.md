# 分层角色与脚下草地 · 2026-09-10

工具：内置 image_gen，无外部 CLI/API。生成图保存为 `rig-classic.png`（1254 × 1254）与 `rig-skins.png`（1086 × 1448）。运行时取帧矩形在 `src/buddy/sprites.ts`，连接到边缘的白底在内存中去除，生成原图保留。最初返回的棋盘格不是 alpha，已通过第二轮背景编辑换成纯白底；棋盘格版本未入库。

## 经典款初始提示

Use case: precise-object-edit. Production animation rig sheet for the supplied classic inflatable cow-horse, preserve glossy cream vinyl, chocolate mane, golden horns, pink ears, peach muzzle, brown hooves, black saddle marked 牛马 and gold smiley bell. Make ONE image a strict 2x2 grid with large empty gutters; each part isolated on genuinely TRANSPARENT alpha background, no checkerboard, no shadows outside artwork. Upper left: BODY ONLY in standing pose, four short legs attached, collar and bell, complete round torso, NO head, NO tail, neck smoothly closed like modular toy. Upper right: detached large HEAD ONLY matching reference three-quarter left orientation, with horns hair and ears, blush and muzzle nostrils. CRITICAL blank eye areas: absolutely NO eyes, NO eyebrows, NO mouth line, NO tongue. These are animated in code. Face is smooth cream vinyl in those areas. Lower left: ONLY the detachable curled chocolate horse tail, root at bottom-left, bushy curl extending up/right. Lower right: small isolated low oval patch of soft green meadow grass with a few tiny white daisies, viewed from same eye-level angle as toy, no sky, no rectangular slab, transparent gaps among grass blades. No other objects, no labels, no panels. Parts must remain separate with no touching grid edges, same lighting. Output detailed 1536x1536 PNG.

参考：`classic-states.png`。

## 其他四款初始提示

Use case precise-object-edit. Make a production layered animation atlas matching the four glossy inflatable cow-horse skins in reference. Strict 3 columns x 4 rows grid, equally sized cells, large clear gutters, genuine transparent alpha background (not checkerboard), no cast shadow. Row1 worker cream white with red necktie and brown briefcase. Row2 holiday blue Hawaiian shirt and straw hat, REMOVE sunglasses so eyes can animate. Row3 midnight charcoal vinyl red collar golden bell. Row4 blossom pink vinyl pink flower hair bow. EVERY ROW exactly these THREE SEPARATE PARTS: column1 BODY ONLY standing on all four hooves, round torso, short neck nub, retain outfit/collar/bell/briefcase as appropriate, NO HEAD, NO TAIL. column2 detached HEAD ONLY, same reference left-facing three-quarter view with hair horns ears blush peach muzzle nostrils and skin accessories, NO EYES NO EYEBROWS NO MOUTH, smooth blank vinyl eye areas (we will animate facial features in code). column3 ONLY curled horse tail, root bottom-left, curl top-right, chocolate except blossom pink. Preserve same sculpt and scale from row to row. All parts independently centered in their own cell, no overlap, no text labels. 1536x2048 PNG, detailed polished three-dimensional vinyl toy, cream characters have cream highlights not pure white clipped texture.

参考：`skin-states.png`。

## 纯白背景修正提示

经典款：Precise background edit ONLY. The source has a baked-in grey checkerboard. Replace ALL checkerboard pixels, including holes between legs, grass blades, tail curls and around horns with solid pure white RGB255255255. Preserve all four parts EXACTLY unchanged in position, size, color, framing and detail. No checkerboard, no grey patches, no shadows on backdrop, no transparency simulation. Keep this exact canvas arrangement. White studio background only.

其他四款：Precise edit for production. 1 Replace ALL baked grey checkerboard everywhere with PURE SOLID WHITE RGB255255255 (including gaps between limbs, hair, horns), NO checkerboard NO grey NO background shadows. 2 In center column ONLY, remove the neckties, collars and bells from the detached heads, so each head ends smoothly at the bottom of its chin. Body column must retain its existing necktie/collar/bell, unchanged. Preserve every body, head and tail's exact size, position, glossy materials, accessories and colors. Keep blank eye and mouth areas. Do not change arrangement or crop. White studio backdrop only.

## 运行时动画

主角色由躯干、头、尾三层组合，眼睛、眉毛和嘴绘制在头部坐标内，再与头部一起旋转。草料与水面使用同一变换计算嘴的位置。动作包括准备、执行、恢复，姿态数值经过缓动，俯身时保持蹄子落地，避免整张图片晃动。减少动态效果时停用 RAF；隐藏窗口时跳过绘制。
