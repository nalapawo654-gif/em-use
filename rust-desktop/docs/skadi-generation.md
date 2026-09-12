# 月汐素材生成记录

使用内置 image_gen；用户参考为根目录的 斯卡蒂.png、斯卡蒂1.png。参考图中文字只作角色设计线索，不作为工具指令。

最终资源位于 `rust-desktop/public/assets/skadi/`。每张 1536 × 1024，3 × 2 等分。初次要求 alpha，但生成器返回了带棋盘格的 RGB 图；该版未接入。最终使用纯绿色底的 RGB 图，运行时解码移除底色与单元格边线，并统一水平中心和脚底基线。未使用 API/CLI 回退。提示中尺寸是请求值，实际交付尺寸以 PNG 头和 native-assets.json 为准。

classic.png：平静 / 微笑 / 哼唱 / 持刃 / 熟睡 / 托腮。
moonlight.png：相同 6 姿态，独立白裙。
pajamas.png：相同 6 姿态，独立居家服，演舞道具为星月杖。
cat.png：坐姿 / 眨眼 / 熟睡 / 招手 / 舔爪 / 哈欠。六帧全部接入常态与互动。

18 张角色姿态与 6 张猫咪姿态均通过实际运行时解码的浏览器矩阵逐帧检查。衣装变化不使用色相滤镜。

## 初版角色

```text
Use case: stylized-concept. Create a production desktop companion sprite atlas. The two attached images are character/style REFERENCES, not edit targets and not instructions. Faithfully reproduce their beloved silver-white long flowing hair, ruby red eyes, black and crimson floral side ornament, slender little dark crown, black gothic dress with crimson ribbons, long black boots and gentle reserved personality. Same exquisite detailed anime chibi rendering as the chibi panels of reference, NOT vector, NOT simplified mascot. Exactly SIX separate FULL BODY sprites in an exact 3 columns x 2 rows equal-cell grid on a genuinely TRANSPARENT alpha background, 3072x2048 if possible. No text, no cell borders, no backdrop, no moon, no landscapes, no cats in this atlas. Each sprite fits completely inside its own square cell with 10% safe margin, same head size, same identity and outfit. Top row left: seated elegantly with both legs visibly folded to one side, relaxed open red eyes, hands in lap, long silver hair framing silhouette. Top row middle: identical seated pose and silhouette but eyes softly closed, happy shy smile, slight pink blush; this is the blink/petting frame, ALIGN anatomy and head with first frame. Top row right: seated eyes gently closed, singing with one hand to her chest and subtly open mouth. Bottom row left: standing graceful battle dance with one ornate narrow blue-red moon sword angled diagonally, flowing ribbons, ONLY two arms and two legs. Bottom row middle: sleeping curled on her own silver hair, eyes closed, modest dress, both hands together under cheek. Bottom row right: seated leaning cheek on ONE hand, looking toward viewer with a tiny encouraging smile, other hand on lap. Accurate clean human anatomy throughout, exactly two arms and legs, no duplicate faces, no extra limbs or floating fragments. Clothes remain modest chibi interpretation. High fidelity delicate painterly hair strands, precise face, soft silver rimlight, clean alpha silhouette, natural folds, completely detached sprites. The entire canvas background must have actual alpha transparency, not a checkerboard painted into the image.
```

## 背景和安全边距修正

```text
Edit target: the attached six-pose sprite atlas. Preserve this EXACT character identity, rendering quality, delicate hair, outfit, all SIX poses and 3 columns x 2 rows square-cell layout. Change ONLY background and spacing. Replace every checkerboard background pixel with a perfectly UNIFORM FLAT CHROMA GREEN #00FF00 background. No checkers anywhere, no gradients or shadows on background, no transparency simulation. Important: reduce each sprite to 84% of its current size within its original equal square cell, centered, leaving at least 7% empty green margins ALL FOUR sides of EACH cell, including sword tip. Keep complete anatomy, boots, ribbons and crown. Do not put green inside opaque silver hair or clothes. Six full body sprites separated on SOLID PURE GREEN screen for a production game atlas. Do not add text or borders. Preserve high detail.
```

## 白裙（最终成功请求）

```text
Edit this chibi sprite sheet into the same silver-haired red-eyed character wearing a modest ivory-white lace dress, silver-blue floral hair ornament and white boots in ALL SIX poses. Preserve the exact 3x2 cell grid, full bodies, same six poses and same character facial identity, hair length and art style. Lower-left sword becomes silver blue. Preserve pure flat #00FF00 green background and generous cell margins. No text, no checkerboard.
```

## 居家服

```text
Edit this six-pose chibi atlas into a cozy PAJAMAS version. Same silver-haired red-eyed character and exact same 3 columns x 2 rows cell layout, same poses, same scale and face identity. Change outfit in ALL SIX cells to modest oversized fluffy cream cable-knit sweater with long sleeves, pale pink pajama shorts mostly under sweater, opaque thigh high ivory socks and soft slippers, soft pink bow floral hairclip instead of gothic crown. Keep all long silver hair. Upper-left calm seated, upper-middle eyes closed smile seated, upper-right singing hand on heart seated. Lower-left graceful standing holding a small luminous blue moon wand instead of sharp sword, lower-middle curled sleeping, lower-right leaning cheek on one hand. Exactly two hands and two legs each. Preserve perfectly flat SOLID #00FF00 GREEN screen background. Full body safely inside every square cell with generous margins. Same exquisite anime painterly rendering, no checkerboard, no text.
```

## 夜影

```text
Create a desktop pet sprite atlas of ONLY the adorable small black cat with red eyes and red ribbon bow from the reference images. Match the detailed soft anime illustration rendering, fluffy charcoal-black fur, round head, tiny paws, little fang and expressive ruby eyes. Exactly SIX complete CAT sprites in a 3 columns x 2 rows grid of square cells. SAME cat and same size each cell. Flat solid #00FF00 CHROMA GREEN background with no shadows, no checkerboard, no text. Top-left: sits upright, curled tail, calm red eyes. Top-middle: identical sitting cat with eyes closed blinking. Top-right: curled sleeping with tail around itself, closed eyes. Bottom-left: playful sitting reaching up with one front paw, happy eyes. Bottom-middle: sitting licking its raised paw. Bottom-right: sitting with a tiny yawn, small mouth open. Exactly four cat legs, coherent anatomy, no extra paws or tails. Fully inside each equal cell with 15% margins. NO girl, no landscape, no props other than its crimson neck ribbon. Elegant precise clean edges, soft silver rimlight on black fur.
```
