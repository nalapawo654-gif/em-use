# 仓鼠跑步循环素材

日期：2026-09-10

生成方式：内置 image_gen。使用现有 atlas-chroma.png 作为角色材质参考、用户原始稿作为世界观参考。没有使用 CLI/API。

交付：`public/assets/hamster/run-cycle.png`，实际 1536 × 1024 像素。4 列 × 2 行，每格 384 × 512，背景为色键洋红（目标 #FF00FF），由运行时色键去除。未生成透明棋盘。

## 分格

| 状态 | 帧 | x | y | width | height |
|---|---|---:|---:|---:|---:|
| 开心满额 | 0 | 0 | 0 | 384 | 512 |
| 开心满额 | 1 | 384 | 0 | 384 | 512 |
| 开心满额 | 2 | 768 | 0 | 384 | 512 |
| 开心满额 | 3 | 1152 | 0 | 384 | 512 |
| 疲惫流汗 | 0 | 0 | 512 | 384 | 512 |
| 疲惫流汗 | 1 | 384 | 512 | 384 | 512 |
| 疲惫流汗 | 2 | 768 | 512 | 384 | 512 |
| 疲惫流汗 | 3 | 1152 | 512 | 384 | 512 |

## 素材检查

通过 view_image 检查最终图并通过 sips 核实实际尺寸。四列为右侧伸脚、右侧抬脚/左脚落地、左侧伸脚、左侧抬脚/右脚落地，腿部轮廓明显不同，双脚都可见。头部与躯干保持近似固定，非整张静态图平移。上排开心、下排流汗疲惫可辨。第 3 帧有朝镜头伸足的透视，运行时仍需检查四帧播放的连贯性；不把静态 atlas 检查当作浏览器或原生动画验收。

生成经历一次初稿、两次只改步态的迭代。初稿与第一次修订的第 1/3 列腿部过于相似，未采用；第二次修订明确交换大脚左右位置后采用。

## 初始实际提示词

```text
Use case: stylized-concept.
Asset type: production sprite atlas for a cute 3D furry desktop hamster animation. EXACT output canvas 1536 x 1024 pixels, four equal columns and two equal rows (each cell 384 x 512), no drawn grid.
Input images: image 1 is the EXISTING CHARACTER IDENTITY AND MATERIAL reference; image 2 is the original visual world reference. Generate NEW RUNNING POSES of the SAME golden brown fluffy hamster with creamy white belly, glossy black eyes, tiny pink paws, round ears, red cloth sweatband with no lettering. Preserve polished furry 3D illustration look.
Backdrop: perfectly flat solid #FF00FF magenta everywhere outside the hamster. No shadows cast onto backdrop, no floor, no checkerboard, no transparency simulation.
Composition: eight full body views of exactly the same hamster, slight three-quarter view facing right. Each character stays at exactly the same location relative to its cell and same size, roughly 250 px wide and 380 px tall including ears. Center X in each cell is 192. Head top around local y=65, running foot baseline local y=445. No part crosses cell borders. Consistent head, belly, silhouette size, view angle, and lighting in every frame. Two distinctly visible legs and both pink feet, separated and articulated in every frame; running in place. Slightly elongate lower legs enough that their alternating motion is visibly legible.
Animation: TOP ROW four frames of a joyful energetic full-quota run cycle with bright happy open eyes and smile. BOTTOM ROW the SAME four gait phases, but tired with furrowed eyebrows, panting mouth and small blue sweat drops.
CRITICAL GAIT PHASES left-to-right in EACH row:
1. Left leg extends strongly FORWARD toward screen right, heel/paw ahead of belly; right leg extends BACK toward screen left, toes pushing behind.
2. Left foot down below belly supporting weight; right knee raised forward, right foot curled under knee. Arms counter-swing.
3. Right leg extends strongly FORWARD toward screen right; left leg extends BACK toward screen left. This MUST be opposite to frame 1, with front and rear limbs visibly switched and arm positions switched.
4. Right foot down below belly supporting weight; left knee raised forward, left foot curled under knee. This MUST be opposite to frame 2.
All eight poses have limbs drawn individually, neither leg hidden behind belly. Arms alternate counter to the legs. Frames 1/3 show a wide running stride, frames 2/4 show a compressed high-knee passing pose. This is an animation sprite sheet, not eight duplicates with only facial variations. Avoid static seated poses, no whole-body translations pretending to be running. No wheel, props, clothes apart from red band, hat, ground, smoke, motion lines, arrows, symbols, lettering, watermark, cell labels, numbers, borders.
```

## 第一次步态修订实际提示词（未采用）

```text
Use case: precise-object-edit. Edit this production running hamster sprite atlas, keeping exact 1536×1024 size and 4-column × 2-row equal grid (384×512 cells), solid #FF00FF magenta backdrop, same furry hamster identity, style, red headband, happy upper row and sweaty tired lower row. Keep head centers and character scale fixed.
Targeted correction: The existing first and third columns have nearly identical legs. Correct ONLY the leg and arm gait choreography to obtain genuine alternating run poses. Both legs must be clearly visible, with clear silhouette separation from the belly.
Columns 1 and 2 can remain similar. In columns THREE and FOUR for BOTH rows, the LARGE NEAR-SIDE LEG (the leg rooted below the left/lower side of the white belly, closest to camera) MUST now move in the opposite direction:
COLUMN 3: LARGE NEAR-SIDE LEG kicks BACKWARD to screen LEFT, with that foot clearly extended to screen LEFT behind the bottom of the body and below the rear side. The smaller FAR-SIDE LEG kicks FORWARD to screen RIGHT and is visible below the right side. The two ankles must be widely separated. The visible large near-side arm swings FORWARD to screen right at chest height. This is the reverse leg of column 1.
COLUMN 4: LARGE NEAR-SIDE LEG points DOWN at screen left of the belly center, near-side pink paw flat at the baseline. FAR-SIDE KNEE lifts UP and forward to screen right, far-side foot curled just below right belly. Near-side arm swings backward. This is the reverse of column 2.
Enforce differences between 1/3 and 2/4 by separating the legs clearly and showing the large visible limb as opposite. Keep a cute short-legged hamster, not human or kangaroo. No static duplicated leg silhouettes. No wheel, props, words, numbers, arrows, motion streaks, floor, shadow, grid lines, or fake transparency checkerboard. Whole character complete inside each cell. Same center of head and belly in every frame.
```

## 第二次步态修订实际提示词（最终采用）

```text
Edit the attached sprite sheet with one critical correction. Keep the 1536x1024 canvas, the 4x2 grid, magenta #FF00FF background, all faces, bodies, red headbands, and ALL poses in columns 1 and 2 unchanged.
ONLY EDIT COLUMN THREE in each row: REMOVE the big foot pointing toward the lower RIGHT of the character. Completely erase that rightward leg shape and fill that space with magenta. REDRAW that large leg bent backward, with the large pink foot conspicuously on the LOWER LEFT of the character, pointing LEFT and showing the pink sole. This large foreground leg should extend diagonally down-and-LEFT from the lower-center belly. At the same time redraw the small background leg pointing forward to the RIGHT, with its much smaller pink foot peeking out beyond the right belly edge. Thus the large pink foot is LEFT, small pink foot is RIGHT in column 3. This must visibly differ from column 1, where large foot is RIGHT.
ONLY EDIT COLUMN FOUR in each row: REMOVE the foot held up on the right and move the LARGE foreground knee UP and LEFT across the belly, with a large pink sole visible at the LOWER LEFT belly, while the small far leg points straight down on the RIGHT side at the baseline. Thus column 4 shows large pink foot raised LEFT and small pink foot planted RIGHT; opposite to column 2.
Legs remain short cute hamster legs, both visible. Absolutely do not keep the existing exact same foreground leg silhouette in columns 3 and 4. No other changes. No text, no gridlines, no props.
```
