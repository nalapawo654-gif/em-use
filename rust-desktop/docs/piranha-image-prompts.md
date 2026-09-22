# 食人花素材生成记录

2026-09-22，内置 `image_gen` 工具；未使用 CLI 或外部付费 API。参考图为项目根目录 `食人花.png`。保存原始输出 PNG 的透明通道，未覆盖用户参考图。

## character-atlas.png

Input role: reference image, not an edit target. Use case: stylized-concept. Create a production desktop pet sprite atlas based on the attached reference character, not its poster layout. A single 2048x2048 PNG with TRUE TRANSPARENT alpha background. Exactly 4 columns by 4 rows of equal square cells, 16 separate centered objects, ample transparent padding inside each cell, no grid lines, no labels, no typography. Reference identity: adorable rounded 3D clay carnivorous flower, peach cream petals, smiling yellow flower face with harmless rounded teeth, fleshy green leaves, cream ceramic pot with cute closed eyes and pink cheeks. Warm soft studio lighting, high quality softly textured toy render. Same frontal camera, scale, bottom baseline across character cells.

Row 1: (1) classic relaxed closed-mouth smile full plant pot (2) classic wide open hungry happy mouth full plant pot (3) classic tired wilted petals drooping leaves lightly chipped pot, full plant (4) classic closed pink flower bud sleeping in pot, full plant.

Row 2: (1) classic cheerful laughing eyes full plant (2) classic indignant scrunched eyebrows tiny pout full plant (3) classic happy chewing, tiny blank cream paper corner at mouth full plant (4) classic sleeping drooped head full plant.

Row 3: (1) pink sakura petal skin same plant and pot (2) cactus skin cute green rounded cactus head with peach flower crown and same pot (3) Halloween skin peach flower with purple witch hat in orange pumpkin pot (4) Christmas skin peach flower wearing red Santa hat in pale mint pot.

Row 4 props only, no character or pot: (1) small botanical desk calendar, rounded cream blank paper flip pad held on a green curved leaf stem base, peach petal corner, large blank center (2) cream folded envelope with peach flower wax seal, cradled from below by two curving green vines and leaves, blank envelope (3) small slightly curled blank cream request note with a tiny peach flower emblem (4) tiny peach blossom sprig with green leaves. Keep all 16 objects isolated, never crossing cell boundaries. No backdrop, no cast shadow outside objects, no checkerboard, no numbers, no written text. This is a sprite atlas for code to crop, so align objects precisely on the 4 by 4 grid.

实际输出 1254 × 1254；网格留白不完全均匀，运行时按已校准的边界读取，不按假定的 2048 或等分坐标读取。

## costume-atlas.png

Input role: supporting reference = character-atlas.png. Use case: stylized-concept. Supporting reference is the existing desktop flower pet sprite atlas. Create its COSTUME POSE ATLAS on TRUE TRANSPARENT background. Exactly 4 by 4 regular equal sized cells, square image. Each cell contains ONE complete plant including all of pot with 12% padding on all sides. Consistent scale, camera and pot baseline. No text, no props outside cells, no backgrounds, no shadows, no grid. Maintain reference's soft rounded 3D clay toy look. Row1 all pink sakura flower in cream smiling blushing pot. Row2 all cute green cactus with peach flower crown and face in cream smiling pot (face required). Row3 all peach flower in purple witch hat and orange jack-o-lantern pot. Row4 all peach flower in Santa hat and mint green pot. In EACH ROW, column1 relaxed cheerful closed-mouth smile full open petals; column2 big happy open mouth showing rounded tiny teeth; column3 tired drooping petals and leaves with sad face, costume fully retained; column4 closed sleeping flower bud (for cactus sleeping closed eyes), drooping leaves, same hat and pot retained. 16 distinct complete figures. Preserve costumes across all four poses. Full transparent padding between all figures. No checkerboard or white halos.

实际输出 1254 × 1254。与经典图集分开选帧，互动期间保留当前服装。
