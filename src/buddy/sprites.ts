import { loadImage } from '../aquarium/sprites'
import type { BuddySkin } from '../shared/types'

export type BuddyProp = 'grass' | 'water' | 'brush' | 'ball' | 'hand' | 'mosquito' | 'pump' | 'sign'
const props: BuddyProp[] = ['grass', 'water', 'brush', 'ball', 'hand', 'mosquito', 'pump', 'sign']
const skins: BuddySkin[] = ['worker', 'holiday', 'midnight', 'blossom']
const cache = new Map<string, Promise<HTMLCanvasElement[]>>()
type Rect = [number, number, number, number]
const classicRects: Rect[] = [[48,8,578,672],[628,76,613,597],[14,771,612,422],[628,835,618,338]]
const skinRects: Rect[] = [[26,24,280,296],[335,48,272,272],[630,119,301,205],[931,178,309,152],[26,322,285,305],[334,351,273,281],[629,429,302,205],[930,487,312,154],[26,634,282,294],[335,660,273,271],[632,729,299,205],[930,791,310,156],[27,937,281,293],[336,962,273,270],[629,1034,301,201],[930,1091,309,154]]

function atlas(path: string, columns: number, rows: number, rects?: Rect[], scale = 1) {
  if (!cache.has(path)) cache.set(path, loadImage(path).then(img => Array.from({ length: columns * rows }, (_, index) => {
    const cellW = img.naturalWidth / columns, cellH = img.naturalHeight / rows
    const [sx, sy, sw, sh] = rects?.[index] ?? [index % columns * cellW, Math.floor(index / columns) * cellH, cellW, cellH]
    const c = document.createElement('canvas')
    c.width = Math.round(sw); c.height = Math.round(sh)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
    // Preserve supplied alpha. For studio-white sheets remove only connected
    // background, never enclosed white eyes, shirts or cream body highlights.
    const frame = ctx.getImageData(0, 0, c.width, c.height), px = frame.data, w = c.width, h = c.height
    let hasAlpha = false
    for (let k = 3; k < px.length; k += 4) if (px[k] < 8) { hasAlpha = true; break }
    const seen = new Uint8Array(w * h), queue = new Int32Array(w * h)
    let head = 0, tail = 0
    const add = (i: number) => {
      if (i < 0 || i >= w * h || seen[i]) return
      seen[i] = 1
      const k = i * 4
      if (px[k + 3] < 8 || (!hasAlpha && Math.min(px[k], px[k + 1], px[k + 2]) > 242)) queue[tail++] = i
    }
    for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x) }
    for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1) }
    while (head < tail) {
      const i = queue[head++]; px[i * 4 + 3] = 0
      if (i % w) add(i - 1)
      if (i % w < w - 1) add(i + 1)
      add(i - w); add(i + w)
    }
    if (hasAlpha) {
      // Generated alpha has isolated colored specks: retain coherent artwork.
      seen.fill(0)
      for (let start = 0; start < w * h; start++) {
        if (seen[start] || px[start * 4 + 3] < 32) continue
        head = 0; tail = 1; queue[0] = start; seen[start] = 1
        const visit = (i: number) => { if (i >= 0 && i < w * h && !seen[i] && px[i * 4 + 3] >= 32) { seen[i] = 1; queue[tail++] = i } }
        while (head < tail) { const i = queue[head++]; if (i % w) visit(i - 1); if (i % w < w - 1) visit(i + 1); visit(i - w); visit(i + w) }
        if (tail < 120) for (let i = 0; i < tail; i++) px[queue[i] * 4 + 3] = 0
      }
    }
    ctx.putImageData(frame, 0, 0)
    if (!rects) return c
    const result = document.createElement('canvas'); result.width = result.height = 512
    // One scale per atlas, with a shared ground line; lying poses stay shorter.
    const padding = hasAlpha ? 18 : 2
    result.getContext('2d')!.drawImage(c, (512 - w * scale) / 2, 480 - (h - padding) * scale, w * scale, h * scale)
    return result
  })).catch(error => { cache.delete(path); throw error }))
  return cache.get(path)!
}
export async function buddySprite(skin: BuddySkin, level: number) {
  const index = Math.max(0, Math.min(3, Math.round(level)))
  return skin === 'classic'
    ? (await atlas('./assets/buddy/classic-states.png', 2, 2, classicRects, .72))[index]
    : (await atlas('./assets/buddy/skin-states.png', 4, 4, skinRects, 4 / 3))[skins.indexOf(skin) * 4 + index]
}
export async function buddyProp(name: BuddyProp) { return (await atlas('./assets/buddy/props.png', 4, 2))[props.indexOf(name)] }
