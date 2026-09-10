# 仓鼠服饰 atlas 生成记录

- 日期：2026-09-10
- 生成方式：内置 image_gen；先生成，再针对动物图标与分格留白进行一次精确修正。
- 最终文件：`public/assets/hamster/wardrobe.png`
- 实测尺寸：1536 × 1024。
- 分格：4 列 × 3 行。列边界 0 / 384 / 768 / 1152 / 1536；行边界 0 / 341 / 683 / 1024。应用采用等比例 4×3 分格亦可，所有物件均留在所在单元内。
- 背景：洋红色抠像底；未生成 alpha，接入时沿用现有 atlas 抠像流程。
- 视觉检查：12 件全部为独立空服饰或道具，没有仓鼠身体、脸、手脚、模特、文字或标志；孔洞显示洋红背景。最后一行顶部留白少于提示要求的 40 px，但没有越格或相邻素材污染。
- 本次只产出素材，未修改源码；服饰在角色身上的定位及原生窗口效果由集成验收确认。

| 序号 | 所在格 (列/行，1 起算) | 素材 |
| --- | --- | --- |
| 1 | 1/1 | 黄色工程安全帽 |
| 2 | 2/1 | 蓝色工作背带裤，短躯干部位无裤腿 |
| 3 | 3/1 | 带头灯的蓝色护目镜 |
| 4 | 4/1 | 深蓝小工作马甲 |
| 5 | 1/2 | 黄色雨帽 |
| 6 | 2/2 | 黄色小雨衣，无帽开襟躯干 |
| 7 | 3/2 | 黑色太阳镜 |
| 8 | 4/2 | 薄荷绿夏日短衬衣 |
| 9 | 1/3 | 红白羊毛围巾，空心披肩领圈 |
| 10 | 2/3 | 蓝色针织毛衣 |
| 11 | 3/3 | 红白圣诞帽 |
| 12 | 4/3 | 红色节日小马甲 |

## 参考

- `public/assets/hamster/atlas-chroma.png`：现有仓鼠渲染与比例。
- `仓鼠+修仙3.png`：原始角色/周边设计方向。
- 用户提供的原始机房设计截图：日班、夜班、雨天、夏天、冬天与节日方向。

## 初始提示词

```text
Use case: stylized-concept. Asset type: production dress-up accessory sprite atlas for the existing plump golden hamster desktop pet.
Generate ONE 1536 x 1024 landscape atlas, exactly FOUR columns by THREE rows, each cell approximately 384 x 341 pixels. Invisible grid, no drawn lines, absolutely uniform pure #FF00FF magenta background everywhere including inside clothing holes, no checkerboard, no gradient, no cast shadows outside the objects.
Reference image 1 shows the current hamster rendering style and round plump proportions. Reference image 2 shows the original accessory art direction; reference image 3 shows the workshop/season costumes. These are STYLE REFERENCES ONLY: do not draw ANY hamster, animal, face, hands, feet, body, mannequin, or fur. This sheet contains ONLY twelve isolated detached clothing/accessory objects.
Polished cute dimensional game illustration, warmly lit, detailed cloth and metal, soft volumetric rendering matching the references. Every object shown front-facing slightly turned to viewer's right, designed for an extremely round short hamster torso with large round head and tiny limbs exposed. Every object completely isolated and centered inside its own cell with at least 40 px margin. No object crosses cells. Do not include words, logos, labels, numbers, captions, panels, UI or decorative marks.
Read left-to-right then top-to-bottom, exact order:
Row 1: (1) yellow miniature construction hard hat; (2) blue denim worker overalls, only a VERY SHORT ROUND torso garment with two shoulder straps and bib, NO trouser legs, no head, no feet; (3) blue protective goggles with a single small headlamp mounted centered above the lenses, no head; (4) very short round dark navy worker vest, empty armholes and neck hole.
Row 2: (5) yellow small rain bucket hat; (6) small yellow open-front raincoat torso garment, NO hood, extremely short and round, little armholes instead of long sleeves; (7) black miniature sunglasses only; (8) mint green short summer shirt, short and wide round torso, tiny sleeve openings.
Row 3: (9) red and white knitted scarf wrapped as a rounded shoulder collar with an EMPTY central neck opening, short scarf tails; (10) blue knitted winter sweater, short and round torso with tiny sleeve openings; (11) red Santa hat with white fluffy brim and white pompom, NO head; (12) small red festive waistcoat, short round torso, gold trim, empty neck and armholes.
This is an overlay clothing asset sheet. All twelve garments are EMPTY floating items, there must be NO characters wearing them and NO anatomical hamster shapes filling them. Show pure magenta through every neck hole and armhole. Keep exact 4-column 3-row ordering and 1536x1024 canvas.
```

## 修正提示词

```text
Use case: precise-object-edit. Edit this exact clothing atlas. Preserve the polished art, all 12 item types, colors, order and pure #FF00FF background. Make only these corrections:
1. Remove ALL small animal and paw emblems: the paw badge on yellow hard hat becomes a plain round silver inset; hamster patch on denim becomes blank denim; hamster patch on rain hat becomes plain yellow; animal patch on scarf becomes plain red knit. No logos or animal symbols anywhere.
2. Enforce 1536 x 1024 canvas with FOUR columns at x=[0,384,768,1152,1536] and THREE rows at y=[0,341,683,1024]. Every object must be entirely inside its designated cell with AT LEAST 40 pixels clear margin on EVERY edge. Scale each object down uniformly around its own cell center until it fits. Third row MUST have all objects including the Santa hat start BELOW y=723. First row object lower edges must be ABOVE y=301. Second row must fit between y=381 and y=643. Bottom row lower edges must be ABOVE y=984. Keep objects centered. Do not draw grid lines.
ALL GARMENTS EMPTY. NO characters, bodies, faces, hands, feet or mannequins. Background must remain solid #FF00FF everywhere including all neck and arm holes. No text.
```
