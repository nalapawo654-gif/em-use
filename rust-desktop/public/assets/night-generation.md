# Aquarium night-light assets

- Built-in image generation tool, edit mode, generated 2026-09-09.
- Original day assets preserved unchanged.
- Output `aquarium-night.png`: 1254 × 1254 PNG.
- Output `aquarium-empty-night.png`: 1254 × 1254 PNG.
- Both contain a dark navy raster background; the application's existing bowl silhouette clipping must remove all exterior pixels. These files do not claim alpha transparency.
- Visual inspection: silhouette, lip, waterline (filled version), garden and castle align closely with the source. Night variants have cyan light under the existing lip and warm castle-window illumination. Empty variant has no waterline or bubbles. Generative edits cannot guarantee exact pixel equality; no resolution conversion was performed.
- Source tool outputs: `/Users/terriblewich/.codex/generated_images/01a085e7-43c8-7212-8fe7-3bbb30bb73fe/exec-e1cfd64c-01ec-4fa9-8486-1874ccb76080.png`, `/Users/terriblewich/.codex/generated_images/01a085e7-43c8-7212-8fe7-3bbb30bb73fe/exec-ae7900b6-8a5e-4d9b-9a48-31fdb5940111.png`.

## Filled variant prompt

Edit reference: `aquarium.png`.

Use case: lighting-weather. Edit target: supplied aquarium.png. Make a production night-light variant of this exact 1254x1254 stylized 3D glass fishbowl asset. Keep pixel-aligned framing, bowl silhouette, upper lip, same blue water height around y=370, every plant/rock/castle/sand location and scale exactly unchanged. Change lighting only: uniform very dark navy backdrop and dark translucent navy glass instead of white haze. A soft luminous cyan LED-like strip just under the EXISTING upper glass lip shines down into the aquarium; realistic blue/cyan caustics through the still blue water; small warm amber glow inside existing castle windows, attractive luminous garden still legible. Balanced soft nighttime lighting, no overexposure. No fish, text, extra objects, furniture, room, scenery, opaque pale white interiors, new lamp hardware, changed geometry, or crop. Preserve exact source square resolution and composition. Output one complete edited asset, not a comparison board.

## Empty variant prompt

Edit target: `aquarium-empty.png`. Lighting reference: `aquarium-night.png`.

Use case: precise-object-edit / lighting-weather. Image 1 aquarium-empty.png is the edit target, Image 2 aquarium-night.png is exact desired night lighting/style reference. Make the EMPTY night variant, retaining exact Image 1 pixel-aligned 1254x1254 composition, bowl silhouette, lip, all garden/plants/rocks/castle/sand placement and scale. Apply Image 2's dark translucent navy glass, luminous cyan strip glow under existing upper rim, blue side rim highlights, warm amber glow inside existing castle openings, same dark navy uniform background. Critical: this is EMPTY of water, NO water surface, NO blue filled region, NO bubbles, NO underwater ripples/caustics hanging in air. Clear dark navy empty glass interior with subtle soft downward light shafts from upper lip. Garden still softly lit with same colors. No fish/text/new objects/new lamp hardware/room/background scene. Preserve precisely aligned silhouette and square source resolution. Output a single edited asset.
