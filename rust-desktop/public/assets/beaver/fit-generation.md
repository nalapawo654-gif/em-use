# 2026-09-10 穿戴与啃损修正

生成工具：image_gen。图集由运行时去除白色背景、独立裁帧并绑定角色部位；不将整张图当作界面。保留原始生成图。

输出：`fitted-hats.png`（3×2 独立帽子）、`fitted-clothes.png`（2×2 雨衣 / 红围巾 / 橙围巾 / 背心）、`quota-trees-v2.png`（3×2 六档啃损）。裁剪区域由 sprites.ts 明确指定。

## 衣物提示

Create 2x2 game sprite atlas 1024x1024 of separate clothing overlays for the plump sitting right-facing beaver body in reference. Each clothing piece isolated on PURE WHITE with 45px margins. NO animal, fur, head, hands, feet or mannequin. Warm 3D detailed cloth matching reference beaver. First top-left: complete golden yellow sleeveless raincoat torso, plump rounded pear-shaped body with open neck hole at UPPER RIGHT, front button placket toward RIGHT, armhole at upper-right side, flared hem fully visible; fits sitting plump body, no hood, no sleeves, coat covers chest and belly. Top-right: complete thick RED knitted scarf loop viewed 3/4 toward RIGHT, snug curved collar around neck, two long fringed ends hanging downward at right-front, no hat. Bottom-left: cozy rust orange woven scarf loop with short fringed tails, matching windy weather, same perspective. Bottom-right: tiny navy-blue sleeveless camping vest torso, rounded plump body, neck opening UPPER RIGHT, two small pockets, same pose as raincoat. Bottom layer clothing should fit under separate animal head and arms. No letters, no grid lines, no background shadow.

## 树木提示

Edit ONLY the bite holes in this 3x2 tree sprite atlas (reference image). Keep full trees, positions, scale, roots, foliage, style and pure white background EXACTLY. The quota removal MUST be much more dramatic: top-left intact 100%; top-middle 75% remaining = visibly REMOVE ONE QUARTER of trunk thickness from LEFT; top-right 50% remaining = REMOVE EXACTLY HALF of trunk thickness, huge bright raw wood concave bite reaches trunk CENTER LINE; bottom-left 25% remaining = REMOVE THREE QUARTERS of trunk thickness, only one quarter remains at RIGHT; bottom-middle 10% remaining = REMOVE NINETY PERCENT, only a very THIN sliver supports leaning trunk; bottom-right fallen tree unchanged. All upright bites centered at y300 within each 512px cell, height 145px, with distinctive large pale ivory exposed wood surfaces and curved tooth marks. In 50% cell the white-background cavity must visibly cut halfway through the trunk, NOT merely scratch the surface. Deepen both cutout silhouette and exposed light wood, do not just brighten the bark. No animals, numbers or labels. Preserve original total silhouette and white cell margins.

## 帽子提取提示

Precise object extraction edit: Remove ALL beaver heads, ears, fur, faces, noses, teeth and necks from this image. Keep ONLY the five HATS exactly as they currently appear, without changing their angles, textures, positions or sizes. Replace every removed animal pixel with pure white. Hats are separate floating clothing sprites, no animal or mannequin should remain. Keep straw hat, yellow rain hat, knitted winter beanie, leather goggles cap and navy headlamp cap. Preserve complete existing hat outlines; wherever head occluded a tiny lower edge, close the hat with a short natural curved edge, no face opening or hollow interior. Same 1536x1024 3-column 2-row atlas, last cell blank white. No text.
