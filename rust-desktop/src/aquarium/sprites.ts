export type SpriteName = 'fish' | 'chest' | 'chestOpen' | 'cave' | 'sponge' | 'sailor' | 'royal' | 'ribbon' | 'pearl'
export type Sprites = Record<SpriteName, HTMLCanvasElement>
let pending: Promise<Sprites> | undefined
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('图片加载失败')); img.src = src })
}
// Mask only border-connected studio white, keeping enclosed white eyes/stripes.
// Work at runtime; source artwork remains unchanged. Each atlas cell is isolated first.
function matte(img: HTMLImageElement, cell?: number): HTMLCanvasElement {
  const c = document.createElement('canvas'), unit = cell === undefined ? img.naturalWidth : img.naturalWidth / 2
  c.width = unit; c.height = cell === undefined ? img.naturalHeight : img.naturalHeight / 2
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, cell === undefined ? 0 : (cell % 2) * unit, cell === undefined ? 0 : Math.floor(cell / 2) * c.height, c.width, c.height, 0, 0, c.width, c.height)
  const frame = ctx.getImageData(0, 0, c.width, c.height), px = frame.data, w = c.width, h = c.height
  const seen = new Uint8Array(w * h), queue = new Int32Array(w * h); let head = 0, tail = 0
  function add(i: number) {
    if (i < 0 || i >= w * h || seen[i]) return
    seen[i] = 1; const k = i * 4
    if (Math.min(px[k], px[k + 1], px[k + 2]) > 242) queue[tail++] = i
  }
  for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1) }
  while (head < tail) { const i = queue[head++]; px[i * 4 + 3] = 0; if (i % w) add(i - 1); if (i % w < w - 1) add(i + 1); add(i - w); add(i + w) }
  ctx.putImageData(frame, 0, 0)
  // Trim the empty studio margin for predictable attachment and hitbox geometry.
  let left = w, right = 0, top = h, bottom = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3]) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
  if (left > right) return c
  const result = document.createElement('canvas'); result.width = right - left + 1; result.height = bottom - top + 1
  result.getContext('2d')!.drawImage(c, left, top, result.width, result.height, 0, 0, result.width, result.height)
  return result
}
export function loadSprites(): Promise<Sprites> {
  return pending ??= Promise.all([loadImage('./assets/clownfish.webp'), loadImage('./assets/play-atlas.webp'), loadImage('./assets/outfit-atlas.webp')]).then(([fish, play, outfits]) => ({
    fish: matte(fish), chest: matte(play, 0), chestOpen: matte(play, 1), cave: matte(play, 2), sponge: matte(play, 3),
    sailor: matte(outfits, 0), royal: matte(outfits, 1), ribbon: matte(outfits, 2), pearl: matte(outfits, 3),
  })).catch(error => { pending = undefined; throw error })
}
