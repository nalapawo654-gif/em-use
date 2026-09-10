# Skin state atlas generation

- Tool: built-in `image_gen`, no CLI fallback.
- Output: `skin-states.png`.
- Source: `/Users/terriblewich/.codex/generated_images/01a0891f-3509-7cf3-8a0c-5d5eda47072f/exec-9f3a90d5-2e80-44e2-8c5f-1bf00cbddd7a.png`.
- Layout: 4 rows (office, vacation, charcoal, pink), each with 4 columns (full, slightly deflated, lying, flattened).
- Opaque white background, intended for edge-connected white removal.

## Prompt

Use case: stylized-concept. Asset type: production game character sprite sheet, 2048x2048 square PNG, 4 columns and 4 rows in exactly equal invisible cells, total 16 sprites. Primary request: create sixteen full-body variations of the same adorable inflated vinyl cow-horse hybrid toy pet, in polished glossy soft 3D style. Identity in EVERY cell: squat plump cow-like white or colored body with stitched inflated toy seams, rounded peach muzzle, tiny golden horns, cute small ears, horse-like curly chocolate mane and curled tail, short stubby legs, glossy button eyes, dark hooves. All face three-quarter LEFT, the same recognizable character and camera angle. Pure opaque white #FFFFFF background across entire image, absolutely no cast shadows, no ambient shadows, no floor, no checkerboard, no gradients. Fixed layout: four exactly equal columns and rows. Each character fully isolated centered within its cell, entire body, horns, accessories, feet and tail fully inside cell, character takes 75-82 percent cell width with ample white gutters. Row 1 = office-worker skin, white body wearing a white shirt, red necktie, a small brown briefcase positioned close alongside body. Row 2 = vacation slacker skin, white body wearing a blue Hawaiian floral shirt, black sunglasses and a small straw hat. Row 3 = cool black skin, charcoal dark gray body with dark brown-black mane and tail, gold collar bell. Row 4 = pink cute skin, pale pink body, pink mane and tail, a big pink bow on head, gold collar bell. Within EACH row, the four COLUMNS represent progressively deflated states: Column 1 fully inflated rounded happy standing upright, very plump belly; column 2 slightly deflated smaller tummy and a mildly tired face but standing; column 3 clearly deflated tired with legs folded underneath body lying down, droopy but still recognizable; column 4 completely deflated floppy flattened toy lying prone with closed eyes, squashed belly and splayed small legs. Keep accessories appropriate to skin on all 4 states. Colored glossy vinyl material stays visible against white background. Use crisp clean silhouettes suitable for background removal. Do not add any other props, scene objects, hands, grass, ground, UI, frames, borders, divider lines, text, letters, labels, badges with writing, numbering, watermarks or checkerboard. The image is ONLY the 16 full characters evenly laid out on flat solid white.

## Visual inspection

All sixteen full characters are present, with horns, feet, accessories and tails visible. Costume and state ordering match requested mapping. No text, grid, scene or UI. The tool returned 1254 x 1254 despite the requested 2048 x 2048. Some poses touch or slightly cross mathematical quarter boundaries; extracting by the measured rectangles below is preferable to blindly slicing quarters.

## Measured extraction rectangles

Read-only pixel analysis: primary four-connected components using `min(R,G,B) < 240`, keeping components above 500 pixels, then union of pixels with `min(R,G,B) < 248` inside each component envelope expanded by 3 pixels. The isolated first sprite eye component falls within its body envelope and is included. `bbox` uses `[left, top, rightExclusive, bottomExclusive]`. `crop` adds 2 pixels of white padding and uses `[x, y, width, height]`. No image pixels were changed.

Rows are office, vacation, charcoal, pink. Columns are full, slightly deflated, lying, flattened.

| Row | State | Subject bbox LTRB | Safe crop XYWH |
| --- | --- | --- | --- |
| office | full | [28, 26, 304, 318] | [26, 24, 280, 296] |
| office | slight | [337, 50, 605, 318] | [335, 48, 272, 272] |
| office | lying | [632, 121, 929, 322] | [630, 119, 301, 205] |
| office | flat | [933, 180, 1238, 328] | [931, 178, 309, 152] |
| vacation | full | [28, 324, 309, 625] | [26, 322, 285, 305] |
| vacation | slight | [336, 353, 605, 630] | [334, 351, 273, 281] |
| vacation | lying | [631, 431, 929, 632] | [629, 429, 302, 205] |
| vacation | flat | [932, 489, 1240, 639] | [930, 487, 312, 154] |
| charcoal | full | [28, 636, 306, 926] | [26, 634, 282, 294] |
| charcoal | slight | [337, 662, 606, 929] | [335, 660, 273, 271] |
| charcoal | lying | [634, 731, 929, 932] | [632, 729, 299, 205] |
| charcoal | flat | [932, 793, 1238, 945] | [930, 791, 310, 156] |
| pink | full | [29, 939, 306, 1228] | [27, 937, 281, 293] |
| pink | slight | [338, 964, 607, 1230] | [336, 962, 273, 270] |
| pink | lying | [631, 1036, 928, 1233] | [629, 1034, 301, 201] |
| pink | flat | [932, 1093, 1237, 1243] | [930, 1091, 309, 154] |

Row-major crop array:

```js
[
  [26,24,280,296], [335,48,272,272], [630,119,301,205], [931,178,309,152],
  [26,322,285,305], [334,351,273,281], [629,429,302,205], [930,487,312,154],
  [26,634,282,294], [335,660,273,271], [632,729,299,205], [930,791,310,156],
  [27,937,281,293], [336,962,273,270], [629,1034,301,201], [930,1091,309,154]
]
```

### Uniform scaling and alignment

All 16 sprites share the same source scale. Maximum measured subject is 308 pixels wide and 301 pixels high; maximum padded crop is 312 pixels wide and 305 pixels high. Recommended 512 x 512 output cell: uniform scale `416 / 312 = 4/3` for every sprite, subject centered at x=256 and its measured bottom at y=480. The full standing character remains about 389 to 401 pixels high; flattened characters remain about 197 to 203 pixels high. Do not independently fit each crop to the cell height, which would inflate the deflated poses.

With the two-pixel crop padding, draw each whole crop at `x=(512-cropWidth*scale)/2`, `y=480-(cropHeight-2)*scale`. For another cell size S, scale both destination positions and the common scale by `S/512`. This leaves 32 pixels below the subject for aligned grounding/shadows and preserves consistent body size across costume and quota transitions.
