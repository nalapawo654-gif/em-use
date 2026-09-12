// Authoring rows are intentionally not assumed to be a uniform grid. Each complete
// pose is extracted separately, then grounded at the same baseline without stretching.
export const FEIDUDU_CROPS = [
  [0, 0, 420, 465], [420, 0, 398, 465], [818, 0, 436, 465],
  [0, 470, 433, 354], [433, 500, 410, 324], [843, 465, 411, 359],
  [0, 828, 435, 426], [440, 838, 405, 376], [845, 830, 409, 390],
] as const
export interface FeiduduLayout { x: number; y: number; scale: number }
const layouts = new WeakMap<HTMLCanvasElement, FeiduduLayout>()
export function feiduduLayout(frame: HTMLCanvasElement): FeiduduLayout {
  const layout = layouts.get(frame)
  if (!layout) throw new Error('Missing Feidudu frame layout')
  return layout
}
let pending: Promise<HTMLCanvasElement[]> | undefined
export function feiduduMatte(r: number, g: number, b: number): number {
  // Pure chroma and its antialias fringe; warm yellow, cream, brown and the
  // lavender cushion (which contains substantial green) remain intact.
  return Math.max(0, Math.min(1, (Math.min(r, b) - g - 35) / 65))
}
export function loadFeidudu(): Promise<HTMLCanvasElement[]> {
  return pending ??= new Promise<HTMLCanvasElement[]>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try {
        const frames = FEIDUDU_CROPS.map(([x, y, w, h]) => {
          const crop = document.createElement('canvas'); crop.width = w; crop.height = h
          const ctx = crop.getContext('2d', { willReadFrequently: true })!
          ctx.drawImage(image, x / 1254 * image.width, y / 1254 * image.height, w / 1254 * image.width, h / 1254 * image.height, 0, 0, w, h)
          const pixels = ctx.getImageData(0, 0, w, h)
          let left: number = w, top: number = h, right = 0, bottom = 0
          for (let i = 0; i < pixels.data.length; i += 4) {
            const d = pixels.data, matte = feiduduMatte(d[i]!, d[i + 1]!, d[i + 2]!)
            d[i + 3] = Math.round(d[i + 3]! * (1 - matte))
            if (matte > 0 && matte < 1) {
              // Remove keyed magenta from partially covered edge pixels.
              const alpha = 1 - matte
              d[i] = Math.max(0, Math.min(255, (d[i]! - 255 * matte) / alpha))
              d[i + 2] = Math.max(0, Math.min(255, (d[i + 2]! - 255 * matte) / alpha))
              d[i + 1] = Math.min(255, d[i + 1]! / alpha)
            }
            if (d[i + 3]! > 24) { const px = i / 4 % w, py = Math.floor(i / 4 / w); left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py) }
          }
          ctx.putImageData(pixels, 0, 0)
          if (right <= left || bottom <= top) throw new Error('Empty Feidudu frame')
          return { crop, left, top, width: right - left + 1, height: bottom - top + 1 }
        })
        const scale = Math.min(430 / Math.max(...frames.map(f => f.width)), 430 / Math.max(...frames.map(f => f.height)))
        resolve(frames.map((f, index) => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512
          canvas.getContext('2d')!.drawImage(f.crop, f.left, f.top, f.width, f.height, (512 - f.width * scale) / 2, 465 - f.height * scale, f.width * scale, f.height * scale)
          const crop = FEIDUDU_CROPS[index]!
          layouts.set(canvas, { x: (512 - f.width * scale) / 2 - (crop[0] + f.left) * scale, y: 465 - f.height * scale - (crop[1] + f.top) * scale, scale })
          return canvas
        }))
      } catch (error) { pending = undefined; reject(error) }
    }
    image.onerror = () => { pending = undefined; reject(new Error('肥嘟嘟素材未能加载')) }
    image.src = './assets/feidudu/atlas.png'
  })
}
