# Classic cow-horse sprite atlas

- Tool: built-in `image_gen.imagegen` (no CLI/API fallback).
- Reference: user-supplied `codex-clipboard-0a547427-8729-4a80-8059-fddaff665287.png`.
- Source: `/Users/terriblewich/.codex/generated_images/01a0891f-0415-77d3-9895-1546e04d4245/exec-d9f2563d-da8b-4859-9e76-e0ab00197d5c.png`.
- Output: `classic-states.png`, 1254 × 1254 px, real RGBA transparency confirmed with `sips` and PNG alpha inspection.
- Order: top left full; top right tired; bottom left low; bottom right empty.
- Composition caveat: top-row hooves extend approximately 30 px below the nominal midpoint. For complete figures, sample top row with y=0,height=710 and bottom row with y=710,height=544; each column width=627. The generated image has a small amount of colored edge residue visible on dark backgrounds.
- Original generation produced a baked-in checkerboard background and was discarded; the second built-in edit removed that background. No code/Python image editing was used.

## Original prompt

### Measured frame bounds

Coordinates are source pixels; `rect` is `[x, y, width, height]`. Main character bounds use alpha >= 128 and connected components > 1000 pixels, so isolated background residue is excluded.

| State | Main character bounds (inclusive x/y extrema) | Safe crop rect |
| --- | --- | --- |
| Full | [66, 26, 614, 657] | [48, 8, 578, 672] |
| Tired | [652, 94, 1211, 654] | [628, 76, 613, 597] |
| Low | [32, 789, 608, 1174] | [14, 771, 612, 422] |
| Empty | [642, 853, 1227, 1154] | [628, 835, 618, 338] |

Alpha range: 0–255. Pixel totals: 785807 fully transparent, 785275 partial alpha, 1434 fully opaque. Most foreground pixels have alpha 253 (621281 pixels); this is a near-opaque output from the built-in background extraction.

Use case: stylized-concept.
Asset type: transparent PNG game sprite atlas for an interactive desktop pet. Generate one square 2x2 equal-cell atlas, ideally 2048 x 2048, with exactly FOUR renders of the SAME adorable inflatable cow-horse mascot from the reference. Input image is visual reference only, do not reproduce the UI.
Composition: four equal square cells, no gaps or borders; each cell's character centered horizontally, same three-quarter camera angle facing LEFT, full body with all hooves and curled tail visible, no cropping. Each figure occupies about 82 percent of its cell width with clear safe margins. Match character identity perfectly across four states.
Identity/material: glossy cream-white inflatable vinyl body with subtle stitched inflatable seams, chocolate brown curled forelock/mane and curled horse tail, little warm golden horns, pink ears and rosy cheeks, peach muzzle with two nostrils, round black eyes, dark brown hooves, brown collar and golden smiley bell, black saddle cloth with exact white Chinese text "牛马". High quality soft studio-lit 3D toy rendering, like reference classic cream cow-horse.
Top-left cell: fully inflated, plump and energetic, standing proudly on all four hooves, bright open eyes.
Top-right cell: slightly deflated and tired, still standing on four hooves but shoulders/head a little drooped, sleepy half-open eyes.
Bottom-left cell: clearly deflated and weary, lying with belly low and legs folded, sad-tired half-open eyes, floppy posture.
Bottom-right cell: completely deflated soft flattened toy lying down, relaxed closed eyes and muzzle resting down, cute exhausted pose, no injury.
Background: REAL TRANSPARENT ALPHA around each mascot and throughout empty canvas. Absolutely no painted white background, checkerboard pattern, grass, scene, floor, ground shadows, backdrop panels, border lines, labels, percentages, captions, UI, extra props, or watermark. Only four separate mascot cutouts on actual transparency.

## Transparency correction prompt

Use case: background-extraction. Edit this 2x2 cow-horse sprite atlas by removing the entire gray checkerboard background to REAL TRANSPARENT ALPHA. The checkerboard is currently painted into this image; it must become absent pixels with alpha=0. Keep all four cow-horse figures and exactly their current 2x2 positions, identity, colors, Chinese 牛马 saddlecloth lettering, shapes, and lighting unchanged. No checkerboard pixels, no white background, no gray background, no backdrop or ground shadows. Output a real transparent PNG with RGBA alpha channel, preserving only the four isolated mascots. Preserve square canvas.
