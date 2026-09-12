import type { FoxSkin } from '../shared/types'

// One cached, deterministic decode; animation only transforms the separate layers.
export const FOX_ASSET = './assets/fox/atlas.png'
export function foxMatte(r: number, g: number, b: number): number {
  return Math.max(0, Math.min(1, (g - Math.max(r, b) - 18) / 110))
}
export function tintFoxPixels(d: Uint8ClampedArray, skin: FoxSkin): void {
  if (skin === 'classic') return
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    // Red ears/forehead, warm ivory, and all alpha remain exactly as authored.
    if (!d[i + 3] || Math.max(r, g, b) - Math.min(r, g, b) > 22 || Math.max(r, g, b) > 220) continue
    const ink = (r + g + b) / 3
    d[i] = skin === 'jade' ? ink * .86 : ink * 1.12 + 4
    d[i + 1] = skin === 'jade' ? ink * 1.04 : ink * .98 + 2
    d[i + 2] = skin === 'jade' ? ink * .95 : ink * .79
  }
}
const pending: Record<string, Promise<string[]> | undefined> = {}
export function loadFox(skin: FoxSkin = 'classic'): Promise<string[]> { return decodeFox(FOX_ASSET, 3, 2, skin) }
export function loadFoxGroomRig(skin: FoxSkin = 'classic'): Promise<string[]> { return decodeFox('./assets/fox/groom-rig.png', 3, 1, skin) }
function decodeFox(path: string, columns: number, rows: number, skin: FoxSkin): Promise<string[]> {
  const key = `${path}:${skin}`
  return pending[key] ??= new Promise((resolve, reject) => {
    const image = new Image()
    image.onerror = () => { delete pending[key]; reject(new Error('小狐狸素材加载失败')) }
    image.onload = () => {
      try {
        const frames = Array.from({ length: columns * rows }, (_, index) => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!
          ctx.drawImage(image, index % columns * image.width / columns, Math.floor(index / columns) * image.height / rows, image.width / columns, image.height / rows, 0, 0, 512, 512)
          const pixels = ctx.getImageData(0, 0, 512, 512), d = pixels.data
          for (let i = 0; i < d.length; i += 4) {
            const matte = foxMatte(d[i], d[i + 1], d[i + 2]), alpha = 1 - matte
            d[i + 3] = Math.round(d[i + 3] * alpha)
            if (alpha === 0) { d[i] = d[i + 1] = d[i + 2] = 0; continue }
            if (matte > 0) {
              d[i] = Math.min(255, d[i] / alpha)
              d[i + 2] = Math.min(255, d[i + 2] / alpha)
              // Restore neutral ink at the keyed edge instead of leaving green or magenta spill.
              d[i + 1] = Math.min(d[i], d[i + 2])
            }
          }
          tintFoxPixels(d, skin)
          ctx.putImageData(pixels, 0, 0)
          return canvas.toDataURL('image/png')
        })
        resolve(frames)
      } catch (error) { delete pending[key]; reject(error) }
    }
    image.src = path
  })
}
