# 随机修炼与衣橱素材（第二轮）

2026-09-10，使用内置 image_gen 生成。素材在项目内保存，保留原始 PNG alpha；未使用 CLI/API Key。

| 文件 | 内容 |
| --- | --- |
| skins/classic.png | 云岚道袍，3×2 六姿态 |
| skins/azure.png | 青霄剑修，3×2 六姿态 |
| skins/astral.png | 紫微星官，3×2 六姿态 |
| skins/crimson.png | 朱雀锦衣，3×2 六姿态 |
| materials.png | 4×3：飞剑、丹炉、经卷、星盘、莲冠、月冠、桃花簪、灵葫、玉佩、锦囊、灵珠、莲台 |
| islands.png | 2×2：云海松台、荷塘竹屿、观星石台、雷纹石台 |

衣装帧序为平静、调息、疲惫、零额、结印、抬手。主体动画在最后两姿态与日常姿态之间切换，低额/零额/未知保留自身表情。六姿态通过运行时 CSS 图集选择与过渡显示；法器、饰品、特效另层渲染。

所有 12 件材料均有使用入口：四种修炼使用 0–3 与 10，衣橱使用 4–9，顿悟仙境使用 11。随机六境使用四种浮岛，雷天/雷劫共享雷纹石台并使用不同天气效果。

部分生成遇到网络错误后用内置工具重试成功。青霄另尝试背景提取版本，但最终采用原始六姿态图集：已检查原始 alpha 和浏览器合成，保持原始人物纹理。旧版 cultivator.png / props.png 保留，不覆盖。

## azure

Production transparent game sprite atlas. Reference image is identity and art style only: same adorable black-haired chibi young male immortal. Create NEW 3 columns by 2 rows of equal SQUARE cells on actual transparent background, landscape image. Six complete seated figures, identical scale and baseline, clean space separating cells, no text or scenery. Outfit: luxurious azure teal and ivory swordsman hanfu, embroidered silver clouds, dark teal fitted bracers, broad blue sash, flowing blue sleeves. No weapon attached. Row 1 left: peaceful eyes closed, cross legged, hands open on knees. Row 1 middle: slightly weary face, same pose. Row 1 right: tired droopy eyes and shoulders. Row 2 left: zero-energy comically sooty face and messy hair, still same clothes and pose. Row 2 middle: focused eyes closed, hands joined in a precise Taoist finger seal at chest. Row 2 right: both forearms raised apart to shoulder height, palms inward conjuring, eyes closed. All six wear EXACT SAME azure outfit and have same hair bun with small plain pin. Full body never cropped. Rich hand painted storybook xianxia style matching reference. No aura, props, ground, shadows or UI.

## crimson

Transparent game sprite atlas, 3 columns x 2 rows of equal SQUARE cells, landscape layout. Same cute black-haired young male chibi immortal as reference, premium painted Chinese fantasy style. NEW costume for ALL SIX figures: crimson red and warm ivory ceremonial hanfu embroidered gold phoenix feathers, gold cuffs and wide red-gold sash, simple small gold hairpin (no big crown). Six full seated figures, identical scale and baseline. Reading order: 1 calm closed eyes with palms on knees, 2 slightly weary same pose, 3 exhausted droopy eyes, 4 comically sooty face and messy hair zero-energy same pose, 5 closed eyes both hands joined in Taoist finger seal at chest, 6 closed eyes both forearms lifted outward to shoulder height palms inward conjuring. Entire cross legged bodies with clear padding inside each cell. No background ground particles effects weapons labels or text. True transparent alpha. Same exact crimson outfit in all six cells.

## classic

Create a production sprite atlas of 6 isolated chibi Chinese immortal figures on a TRANSPARENT BACKGROUND with genuine alpha, no background shading anywhere. 3 columns and 2 rows of equal square cells, landscape 1536x1024. Cute black long hair high bun, tiny gold pin, young male round face, ivory white hanfu with pale blue trim and gold sash accents. Painterly premium xianxia game illustration. Reading order: calm cross legged palms resting on knees; weary same pose; exhausted droopy eyes same pose; comically sooty face messy hair same pose; focused closed eyes with hands joined in Taoist finger seal at chest; focused closed eyes with two arms raised to shoulder height and palms facing in. SAME clothing and character size in all 6 cells. Entire bodies separated and within their own cells. No ground, no backdrop, no colored gradients, no drop shadows, no auras, no text. Transparent PNG sprites.

## astral

Transparent PNG sprite atlas, 3 columns by 2 rows, six equal square cells. Cute chibi Chinese male immortal with long black hair and bun, deep PURPLE and midnight BLUE hanfu embroidered gold stars and constellations, flowing violet sleeves. Same outfit and identity in all six full cross-legged seated figures. Reading order: peaceful closed eyes palms on knees, weary face same pose, exhausted droopy eyes, comically sooty face messy hair, focused eyes closed hands joined finger seal at chest, eyes closed with both arms raised palms inward. Same scale baseline, no text no props no scenery, actual transparent alpha. Premium richly painted xianxia illustration.

## materials

Production transparent PNG atlas, exactly 4 columns by 3 rows of equal square cells, 12 separate isolated Chinese xianxia game objects. Reading order row1: ornate silver flying sword angled diagonal; jade and bronze alchemy cauldron; unfurled ivory scroll with mystical decorative calligraphy; gold circular astrolabe with blue stars. Row2: small white jade LOTUS CROWN; golden CRESCENT MOON CROWN with stars; pink peach blossom HAIRPIN; polished orange spirit GOURD with jade stopper and red cord. Row3: double fish jade PENDANT on tassel; red embroidered drawstring lucky POUCH; luminous jade SPIRIT PEARL; ornate pink LOTUS pedestal. Rich painterly game art ivory jade gold, all objects fully inside own cell with clear padding. NO character, no background gradient, no ground, no labels, no borders. Actual transparent alpha background.

## islands

Transparent PNG game atlas, 2x2 equal square cells. Four isolated floating islands, wide flat seating surface, rocky tapering bottom. Top left: mossy cloud island with tiny pine at rear. Top right: lotus pond island with lilies and bamboo at rear. Bottom left: dark blue star observatory stone island with sapphire crystals. Bottom right: purple thunder rune stone island with amethyst crystals. No people, no skies, no rectangular backgrounds, no labels. Premium hand painted Chinese xianxia fairy tale props. All four completely contained within their cells, separated by transparent padding. Actual alpha transparency.
