import type { SkadiForm, SkadiSkin } from '../shared/types'
export function skadiAsset(skin: SkadiSkin, form: SkadiForm): string { return `./assets/skadi/v2/${form}-${skin}.png` }
const transforms = new Map<string, { x: number; y: number; scale: number }[]>()
export function skadiSpritePoint(form:SkadiForm,skin:SkadiSkin,frame:number,p:[number,number]):[number,number]{const t=transforms.get(skadiAsset(skin,form))?.[frame];return t?[p[0]*t.scale+t.x,p[1]*t.scale+t.y]:p}
export function skadiWeaponPoint(index:number,p:[number,number]):[number,number]{const t=transforms.get("./assets/skadi/v2/weapons.png")?.[index];return t?[p[0]*t.scale+t.x,p[1]*t.scale+t.y]:p}
const cache = new Map<string, Promise<string[]>>()
// The generator returned RGB, so the authored green screen is keyed once at decode.
// This is deliberately independent of quota and preserves the red eyes and pale hair.
export function skadiMatte(r: number, g: number, b: number): number {
  return Math.max(0, Math.min(1, (g - Math.max(r, b) - 12) / 130))
}
export function loadSkadi(skin: SkadiSkin, form: SkadiForm = 'chibi'): Promise<string[]> { return decode(skadiAsset(skin, form), 3, 2) }
export function loadSkadiWeapons(): Promise<string[]> { return decode('./assets/skadi/v2/weapons.png', 3, 2) }
export function loadSkadiProps(): Promise<string[]> { return decode('./assets/skadi/v2/props.png', 3, 2) }
export function loadSkadiCat(): Promise<string[]> { return decode('./assets/skadi/cat.png', 3, 2) }
function decode(path: string, columns: number, rows: number): Promise<string[]> {
  if (cache.has(path)) return cache.get(path)!
  const pending = new Promise<string[]>((resolve, reject) => {
    const image = new Image()
    image.onerror = () => { cache.delete(path); reject(new Error('月汐素材加载失败')) }
    image.onload = () => {
      try {
        const frames = Array.from({ length: columns * rows }, (_, index) => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!
          ctx.drawImage(image, index % columns * image.width / columns, Math.floor(index / columns) * image.height / rows, image.width / columns, image.height / rows, 0, 0, 512, 512)
          const pixels = ctx.getImageData(0, 0, 512, 512), d = pixels.data
          for (let i = 0; i < d.length; i += 4) {
            const x = i / 4 % 512, y = Math.floor(i / 4 / 512)
            // Discard only the outer cell gutter (the cat sheet includes grid separators).
            if (x < 4 || x > 507 || y < 4 || y > 507) { d[i + 3] = 0; continue }
            const matte = skadiMatte(d[i], d[i + 1], d[i + 2]), alpha = 1 - matte
            d[i + 3] = Math.round(d[i + 3] * alpha)
            if (!alpha) { d[i] = d[i + 1] = d[i + 2] = 0; continue }
            if (matte > 0) {
              d[i] = Math.min(255, d[i] / alpha); d[i + 2] = Math.min(255, d[i + 2] / alpha)
              d[i + 1] = Math.min(d[i], d[i + 2])
            }
          }
          ctx.putImageData(pixels, 0, 0)
          // Keep all poses on the same baseline, with matching horizontal centers.
          // Each cell was authored with a margin; alignment avoids a sideways blink jump.
          let left = 512, right = 0, top = 512, bottom = 0
          for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
            if (d[(y * 512 + x) * 4 + 3] > 100) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
          }
          return { canvas, left, right, top, bottom }
        })
        // A common scale across the atlas preserves anatomy and head size between poses.
        // Fit before baseline alignment so tall adult crowns never get clipped.
        const scale = Math.min(1, ...frames.map(f => Math.min(456 / (f.right-f.left+1), 456 / (f.bottom-f.top+1))))
        transforms.set(path,frames.map(f=>({x:256-(f.left+f.right)/2*scale,y:484-f.bottom*scale,scale})))
        const urls = frames.map(f => {
          const aligned = document.createElement('canvas'); aligned.width = aligned.height = 512
          aligned.getContext('2d')!.drawImage(f.canvas, 256 - (f.left + f.right) / 2 * scale, 484 - f.bottom * scale, 512 * scale, 512 * scale)
          return aligned.toDataURL('image/png')
        })
        resolve(urls)
      } catch (error) { cache.delete(path); reject(error) }
    }
    image.src = path
  })
  cache.set(path, pending)
  return pending
}
