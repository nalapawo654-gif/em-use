# Buddy props generation

- Date: 2026-09-10
- Tool: built-in image_gen (not CLI/API)
- User reference: /var/folders/5b/frdhbys12mzdd4v9nw0z14z40000gn/T/codex-clipboard-0a547427-8729-4a80-8059-fddaff665287.png
- Final source: /Users/terriblewich/.codex/generated_images/01a0891f-6c89-7852-aff3-10dc8a3e3937/exec-304c6537-778a-41e2-b926-08c0cd67cc1e.png
- Project asset: public/assets/buddy/props.png
- Verified dimensions: 1774 x 887 pixels, exact 2:1 aspect ratio, 4 columns x 2 rows (fractional cells 443.5 x 443.5 pixels).
- Alpha: none. The tool failed to provide genuine alpha and produced baked checkerboard twice. Final selected image is white background for runtime edge-connected white removal, per main agent instruction. No local pixel editing was performed.
- Order (row-major): grass, water bucket, cleaning brush, football, patting hand, mosquito, air pump, blank wooden quota sign.
- Visual check: all 8 props complete, centered, distinct; no labels; blank sign face retained. Main agent should preserve bright whites inside the football and mosquito wings when removing the connected exterior white background.

## Initial prompt

Use case: stylized-concept
Asset type: production sprite atlas of 8 interactive props for the attached cute inflatable cow-horse desktop companion UI. Image 1 is style reference ONLY, do not reproduce its UI.
Generate one wide 2:1 ratio 2048x1024 PNG with an ACTUAL fully transparent alpha background. Precisely 4 equal columns and 2 equal rows, each 512x512 cell, no visible grid lines, no labels, no text. Each cell contains exactly one full isolated prop centered in that cell and occupying 75–82% of its cell's available area, with sufficient transparent margin. Props never overlap or cross cell boundaries. All share a premium soft, rounded, adorable 3D toy material, pastel light, gentle glossy finish, camera front three-quarter view, crisp silhouette, same style as reference. No background, no floor plane, no scene, no UI, no baked checkerboard.
Exact order:
Top row left to right:
1. a fresh lush cluster of bright green tender grass fodder blades;
2. a small warm wooden water bucket with dark hoops filled with visibly bright blue water;
3. a wooden-handled cleaning brush with a blue handle end and cream bristles, diagonally oriented;
4. a classic black and white soccer ball.
Bottom row left to right:
5. a cute light-peach skin tone open patting hand palm with five rounded fingers, no arm beyond a short wrist;
6. one cute small stylized mosquito with visible delicate translucent wings, thin legs and small dark body, friendly cartoon toy style;
7. a blue hand-operated floor air pump with a T-shaped handle and a curved flexible hose, all parts fully contained;
8. a wide blank wooden quota sign made of three horizontal warm wooden planks with a short support post underneath. Large completely blank front board face for dynamic code-rendered numbers. No letters, no numbers, no symbols anywhere.
Constraints: exactly 8 objects, one per cell, proper equal atlas alignment, transparent alpha around all objects and between cells, no other accessories, no cropped extremities, no text or watermark.

## Transparency correction (discarded)

Edit target: the supplied 8-prop 4-column 2-row sprite atlas. Precise background extraction. Preserve ALL eight objects exactly, including material, scale, layout, spacing, order, camera and color. Remove the gray checkerboard behind them. Return an ACTUAL transparent RGBA PNG image with alpha=0 for all empty pixels between and around the eight objects. Absolutely no baked-in checkerboard pattern, no floor, no shadow backdrop, no text. If genuine alpha channel is unavailable, the ONLY acceptable alternative background is one perfectly flat solid hot magenta RGB #FF00FF with no variation, gradient, texture, or cast shadow. Keep all object edges crisp including mosquito wings. Keep aspect ratio exactly 2:1 and the 4×2 equal-cell alignment.

## Final white-background correction

Replace ONLY the background of this 8-prop atlas with PERFECTLY SOLID PURE WHITE RGB (255,255,255). This is an opaque white-background product sheet, NOT a transparency request. Completely erase every gray checkerboard square and replace it with pure white. Absolutely no checkerboard, no transparency pattern, no gray pixels in background, no ground, no drop shadows or contact shadows. Preserve exactly all 8 props, same order in 4 equal columns and 2 equal rows, exactly same positions, colors, style, scale and generous margins. Keep 2:1 aspect ratio. The empty space between and around objects must be flat PURE WHITE #FFFFFF.
