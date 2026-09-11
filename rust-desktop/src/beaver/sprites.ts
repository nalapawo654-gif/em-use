import { loadImage } from '../aquarium/sprites'
import type { BeaverSkin } from '../shared/types'
export type BeaverProp = 'brush' | 'noodles' | 'water' | 'logs' | 'ball' | 'leaf' | 'bird' | 'tent' | 'sign' | 'ground'
const propNames = ['brush', 'noodles', 'water', 'logs', 'ball', 'leaf', 'bird', 'tent']
const skinNames: BeaverSkin[] = ['sunny', 'rain', 'snow', 'wind', 'night']
const cache = new Map<string, Promise<HTMLCanvasElement[]>>()
// Like the existing buddy loader, remove only the connected studio background.
// White object details enclosed by a silhouette (eyes, teeth, fleece) stay intact.
function frames(path: string, cols: number, rows: number, trim = true, regions?: number[][], singleObject = false) {
  const key = JSON.stringify([path, cols, rows, trim, regions, singleObject])
  if (!cache.has(key)) cache.set(key, loadImage(path).then(img => Array.from({ length: cols * rows }, (_, index) => {
    const [sx, sy, w, h] = regions?.[index] ?? [index % cols * Math.floor(img.width / cols), Math.floor(index / cols) * Math.floor(img.height / rows), Math.floor(img.width / cols), Math.floor(img.height / rows)]
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h)
    const frame = ctx.getImageData(0, 0, w, h), px = frame.data
    const visited = new Uint8Array(w * h), queue = new Int32Array(w * h)
    let read = 0, write = 0
    const add = (i: number) => {
      if (i < 0 || i >= w * h || visited[i]) return
      visited[i] = 1
      const k = i * 4
      if (px[k + 3] < 8 || Math.min(px[k], px[k + 1], px[k + 2]) > 238) queue[write++] = i
    }
    for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x) }
    for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1) }
    while (read < write) { const i = queue[read++]; px[i * 4 + 3] = 0; if (i % w) add(i - 1); if (i % w < w - 1) add(i + 1); add(i - w); add(i + w) }
    // Discard isolated background residue / neighboring whisker fragments.
    visited.fill(0)
    let largest = new Int32Array(0)
    for (let start = 0; start < w * h; start++) {
      if (visited[start] || px[start * 4 + 3] < 32) continue
      read = 0; write = 1; queue[0] = start; visited[start] = 1
      const visit = (i: number) => { if (i >= 0 && i < w * h && !visited[i] && px[i * 4 + 3] >= 32) { visited[i] = 1; queue[write++] = i } }
      while (read < write) { const i = queue[read++]; if (i % w) visit(i - 1); if (i % w < w - 1) visit(i + 1); visit(i - w); visit(i + w) }
      if (singleObject && write > largest.length) {
        for (const i of largest) px[i * 4 + 3] = 0
        largest = queue.slice(0, write)
      } else if (singleObject || write < 80) {
        for (let i = 0; i < write; i++) px[queue[i] * 4 + 3] = 0
      }
    }
    ctx.putImageData(frame, 0, 0)
    if (!trim) return c
    let left = w, top = h, right = 0, bottom = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 32) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y) }
    if (right < left) return c
    const out = document.createElement('canvas'); out.width = right - left + 1; out.height = bottom - top + 1
    out.getContext('2d')!.drawImage(c, left, top, out.width, out.height, 0, 0, out.width, out.height)
    return out
  })).catch(e => { cache.delete(key); throw e }))
  return cache.get(key)!
}
export const beaverBody = async (level: number) => (await frames('./assets/beaver/states.webp', 3, 2, false))[Math.max(0, Math.min(5, level))]
const dressedHeads = (skin: BeaverSkin) => frames(`./assets/beaver/dressed-heads-${skin}.webp`, 3, 2, false, undefined, true)
export const beaverPortrait = async (skin: BeaverSkin) => (await dressedHeads(skin))[0]
export const beaverTree = async (level: number) => (await frames('./assets/beaver/quota-trees-v2.webp', 3, 2, true, [[0,0,512,512],[512,0,512,512],[1024,0,512,512],[0,512,512,512],[512,512,478,512],[990,512,546,512]]))[Math.max(0, Math.min(5, level))]
export async function beaverProp(prop: BeaverProp) {
  if (prop === 'sign') return (await frames('./assets/beaver/environment.webp', 3, 2))[5]
  if (prop === 'ground') return (await frames('./assets/beaver/wardrobe.webp', 3, 2))[5]
  return (await frames('./assets/beaver/props.webp', 4, 3))[propNames.indexOf(prop)]
}

export async function beaverRig(skin: BeaverSkin) {
  const [parts, objects, sleepers, heads, bodies] = await Promise.all([
    frames('./assets/beaver/rig.webp', 3, 2, true, [[0,0,550,560],[550,0,520,540],[1070,0,466,550],[0,560,550,464],[550,560,520,464],[1070,560,466,464]]),
    Promise.all(['noodles', 'water', 'logs', 'ball', 'bird', 'leaf'].map(name => beaverProp(name as BeaverProp))),
    frames('./assets/beaver/dressed-rest.webp', 3, 2, false),
    dressedHeads(skin),
    frames('./assets/beaver/dressed-bodies.webp', 3, 2),
  ])
  const [, , tail, arm, , chip] = parts
  const body = bodies[skinNames.indexOf(skin)]
  const sleeping = sleepers[skinNames.indexOf(skin)]
  const [noodles, water, logs, ball, bird, leaf] = objects
  return { body, heads, tail, arm, chip, sleeping, noodles, water, logs, ball, bird, leaf }
}
export type BeaverRig = Awaited<ReturnType<typeof beaverRig>>
