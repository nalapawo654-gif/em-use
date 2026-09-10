# Hamster atlas generation

Generated using the built-in image_gen tool on 2026-09-10.

Reference: 仓鼠+修仙3.png (hamster identity and wheel only).

## Status

Archived source file: output/imagegen/hamster/atlas-source.png (not packaged). Actual size: 1536×1024, RGB PNG; **not transparent**. The image tool baked a checkerboard into the background despite two explicit alpha requests. This is a source asset and must not be used directly on a transparent desktop pet without a rendering mask or corrected alpha asset. A subsequent pure magenta background request failed twice with a connection error.

Layout: three columns, two rows; 512×512 per cell. Reading order: wheel, happy running, tired running, exhausted lying down, sunflower-seed snack, blue-blanket sleep. The tired running cell has an extra tiny seed held in one paw. Subjects are complete and inside cells; crouched/sleep poses occupy wider silhouettes. No lettering on headbands.

## Initial generation prompt

Use case: stylized-concept.
Asset type: production transparent desktop pet sprite atlas, a single PNG image.
Input image: reference only for hamster character identity and wheel design. Use ONLY the golden-brown hamster and its wheel from the top part of the reference; do not include any cultivation characters.
Primary request: create exactly 1536 x 1024 pixels, a precise invisible 3-column by 2-row grid of six 512 x 512 pixel cells. True transparent alpha background, no checkerboard baked in, no background scene, no cell borders, no labels, no letters, no text.
Arrange isolated full objects in this reading order, centered within their own cell, nothing crossing a cell boundary:
1. Top-left cell x0-511 y0-511: independent metallic hamster exercise wheel with sturdy small base and support, straight front view with very slight 3/4 depth like reference, no hamster. Rim circular, real ladder rungs around circumference. Wheel centered at x256 y256, entire object fits inside cell with 36px margin.
2. Top-middle cell x512-1023 y0-511: same cute golden-brown hamster with white round belly, shiny black eyes, tiny pink ears, detailed fluffy fur and a solid RED HEADBAND WITH NO TEXT, happily running on the spot with paws raised, without wheel. Entire hamster centered at x768 y256, rendered around 320px tall.
3. Top-right cell x1024-1535 y0-511: identical hamster identity, proportions and plain red headband, tired and sweating but still standing in a running pose, without wheel. Center at x1280 y256 around 320px tall.
4. Bottom-left cell x0-511 y512-1023: identical hamster and plain red headband, exhausted lying on tummy with droopy face and tiny tongue poking out, without wheel. Center x256 y768.
5. Bottom-middle cell x512-1023 y512-1023: identical hamster and plain red headband, happily sitting and holding one large sunflower seed in both paws, eating it, without wheel. Center x768 y768.
6. Bottom-right cell x1024-1535 y512-1023: identical hamster curled up sleeping under a small soft BLUE BLANKET with face visible and eyes closed, without wheel. Center x1280 y768.
Style: premium soft cute 3D animation character with subtly painterly finish, richly groomed golden fur, chubby silhouette, warm studio lighting matching reference, consistent camera and scale in all five hamster cells. Character size approximately 300-340px tall/wide per cell; preserve generous completely transparent margins. No ground, no cast shadows outside subjects, no motion doodles, no lettering or watermarks. This will be sliced by CSS on exact 512px cell boundaries, so accurate grid positioning is critical.

## Alpha correction prompt (still returned RGB)

Use case: background-extraction.
Edit the provided sprite atlas. Preserve every foreground object EXACTLY, preserve their coordinates, size, colors, poses, all six grid locations and canvas size 1536x1024. Remove only the checkerboard background entirely, including spaces within the exercise wheel and between fur tufts. Return a TRUE TRANSPARENT PNG WITH ALPHA CHANNEL; every background pixel must have alpha 0, never simulate transparency with a checkerboard, gray fill, white fill, or texture. This is a production desktop sprite atlas that will be composited on arbitrary user desktops. Keep wheel, all five hamsters, headbands, seed and blue blanket. No object may move, change size, or cross its original 512px cell boundaries. No text. The only change is actual transparency.

## Chroma-key correction prompt (connection failed twice)

Use case: precise-object-edit.
Edit the provided 1536x1024 six-cell sprite atlas. Replace ONLY the entire checkerboard background with perfectly flat uniform pure chroma-key magenta RGB(255,0,255), hex #FF00FF. Keep every foreground object EXACTLY unchanged: same wheel and all five hamsters, their size, positions, colors, camera, fur, poses, seed, red headbands, blue blanket. Preserve exact six-cell grid placement. Fill all visible background including the big interior opening of the wheel, gaps between bars, and spaces around fur with pure #FF00FF. No checkerboard, no gradient, no textured background, no floor, no shadows on background. Keep original 1536x1024 dimensions. Subjects must remain complete within their original 512x512 cells.


## Accepted source and renderer

A subsequent built-in Image Gen correction succeeded: `atlas-chroma.png`, 1536x1024, solid magenta. The running hamster no longer holds a seed. Runtime `src/hamster/sprites.ts` removes the dedicated matte once and caches six canvas textures, preserving white fur. The original checkerboard source is not consumed.

Final prompt: Edit this sprite atlas, preserving all 6 foreground objects and exact 1536x1024 layout and positions. Replace all gray checkerboard background pixels with a perfectly flat solid vivid magenta #FF00FF background, including the enclosed empty opening inside the wheel. Preserve hamster fur white and gold, red headbands, all poses, blue blanket, the metal wheel and stand. Do not add a checkerboard or simulate transparency. Flat uniform pure magenta is essential for rendering. Also remove the small seed in the top right running hamster left paw, replacing it with empty pink paw like the happy running hamster. Do not change any other foreground content. Return the edited PNG.
