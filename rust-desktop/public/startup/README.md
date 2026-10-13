# EM Use · Awakening

Original EM Use motion artwork, authored for this repository on 2026-10-13.
150 light points gather into a little fish emblem, then the EM USE wordmark appears.
No DeepSeek footage, logo, external media, remote font or font binary is bundled.

`awakening.mp4`: 1280 × 720, 30 fps, 3 seconds, H.264 / yuv420p, no audio,
faststart MP4. `poster.jpg` is the matching first frame. The static background,
halos and particle motion are pre-rendered; the application only plays video.

Optional regeneration requires Python, Pillow, imageio-ffmpeg (or --ffmpeg) and a
local serif font. From rust-desktop on macOS:

    python scripts/render-startup.py --font '/System/Library/Fonts/Supplemental/Didot.ttc'

The font is rasterized into artwork, never copied into the app. CI uses the
committed media and does not need these authoring dependencies.
