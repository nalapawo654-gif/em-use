# Wheel parts generation

Built-in image_gen, 2026-09-10. Reference: atlas-chroma.png for metallic material only.

Requested 1024×1024 and exact equal-height cells, but tool generated 1254×1254 with unequal object layout. Sprite extraction must use object bounding boxes rather than halves. Foreground wheel approximately x265–989, y70–785; base approximately x281–974, y923–1144. Pure magenta background supports runtime color key. Wheel is front-on, nearly circular, without support; base separate. Do not use y=627 row split as that cuts wheel.

## Prompt

Use case: stylized-concept.
Asset type: two-part desktop pet exercise-wheel sprite atlas for animation.
Input image: reference for the wheel MATERIAL ONLY, brushed silver-gray metal, subtle warm edge highlights, orange mechanical feet. Do not include any hamster or blanket.
Generate one 1024 x 1024 PNG, an invisible one-column two-row grid: two cells, each 1024px wide and 512px high. Completely flat pure chroma-key MAGENTA #FF00FF RGB(255,0,255) background everywhere behind and inside objects, with NO checkerboard, no gradients, no shadows on the background.
UPPER CELL: one strictly STRAIGHT-ON FRONT-VIEW circular hamster exercise wheel ROTOR. The outer contour is a geometrically perfect circle, exactly 450px diameter, centered at x512 y256. Metallic outer and inner circular rings, shallow metallic tread plates arranged uniformly around the circumference. Broad open empty center showing pure magenta. Every circular component concentric. Minimal symmetric front-on depth shading ONLY, NOT a 3/4 angle, NOT an ellipse, NOT perspective. It will be rotated as a flat sprite, so the silhouette MUST be completely circular. No support, no legs, no floor base, no axle bar, no crossbars, no central hub, no protrusions outside the circle.
LOWER CELL: the matching independent FIXED SUPPORT BASE, centered at x512 y768, approximately 450px wide and 100px high. Two short silver-gray metal support legs rise from a low cylindrical horizontal bottom bar, with small orange end feet and subtle brushed steel details. No wheel, no circular ring above it. Front view consistent with upper sprite.
Style: refined cute 3D game prop matching the reference metallic material and orange accents. Objects complete, isolated, centered exactly as specified, within their respective cell, generous magenta margin. No text, logos, diagrams, cell boundaries, arrows or labels.
