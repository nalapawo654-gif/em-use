// Authoring rows are intentionally not assumed to be a uniform grid. Each complete
// pose is extracted separately, then grounded at the same baseline without stretching.
export const DINOSAUR_CROPS = [
  [0, 0, 425, 475], [425, 0, 398, 475], [823, 0, 431, 475],
  [0, 480, 433, 350], [433, 480, 416, 350], [849, 475, 405, 355],
  [0, 830, 430, 424], [430, 830, 435, 424], [865, 830, 389, 424],
] as const
let pending: Promise<HTMLCanvasElement[]> | undefined
export function dinosaurMatte(r: number, g: number, b: number): number {
  // Remove magenta and its edge fringe; retain green skin, cream belly,
  // orange spikes, gray props and the blue blanket.
  return Math.max(0, Math.min(1, (Math.min(r, b) - g - 35) / 65))
}
export function loadDinosaur(): Promise<HTMLCanvasElement[]> {
  return pending ??= new Promise<HTMLCanvasElement[]>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try {
        const frames = DINOSAUR_CROPS.map(([x, y, w, h]) => {
          const crop = document.createElement('canvas'); crop.width = w; crop.height = h
          const ctx = crop.getContext('2d', { willReadFrequently: true })!
          ctx.drawImage(image, x / 1254 * image.width, y / 1254 * image.height, w / 1254 * image.width, h / 1254 * image.height, 0, 0, w, h)
          const pixels = ctx.getImageData(0, 0, w, h)
          let left: number = w, top: number = h, right = 0, bottom = 0
          for (let i = 0; i < pixels.data.length; i += 4) {
            const d = pixels.data, matte = dinosaurMatte(d[i]!, d[i + 1]!, d[i + 2]!)
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
          if (right <= left || bottom <= top) throw new Error('Empty Dinosaur frame')
          return { crop, left, top, width: right - left + 1, height: bottom - top + 1 }
        })
        const scale = Math.min(430 / Math.max(...frames.map(f => f.width)), 430 / Math.max(...frames.map(f => f.height)))
        resolve(frames.map(f => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512
          canvas.getContext('2d')!.drawImage(f.crop, f.left, f.top, f.width, f.height, (512 - f.width * scale) / 2, 465 - f.height * scale, f.width * scale, f.height * scale)
          return canvas
        }))
      } catch (error) { pending = undefined; reject(error) }
    }
    image.onerror = () => { pending = undefined; reject(new Error('小恐龙素材未能加载')) }
    image.src = './assets/dinosaur/atlas.png'
  })
}
