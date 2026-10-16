import { LruCache } from '../shared/lruCache'
import { loadImage } from '../aquarium/sprites'
import { awakeningAtlas, clearEdgeSpecks } from '../evolution/atlas'
import type { PotatoSkin } from './catalog'

const sheets = new LruCache<string, Promise<HTMLImageElement>>(2)
// Twenty fixed wardrobe entries, separate from the full actor's 12-entry cache.
// 256px canvases cost about 5 MiB in total and need no PNG serialization.
const thumbnails = new Map<PotatoSkin, Promise<HTMLCanvasElement>>()
let queue: Promise<unknown> = Promise.resolve()
export function loadPotatoThumbnail(skin: PotatoSkin): Promise<HTMLCanvasElement> {
  const cached = thumbnails.get(skin)
  if (cached) return cached
  const spec = awakeningAtlas('potato', skin)!
  let sheet = sheets.get(spec.file)
  if (!sheet) {
    sheet = loadImage(`./assets/evolution/v2/${spec.file}`).catch(error => { sheets.delete(spec.file); throw error })
    sheets.set(spec.file, sheet)
  }
  const pending = sheet.then(image => {
    // Yield between cards so input can run even when a cold sheet resolves all
    // four costumes together. Clean only the visible, reduced-size pose.
    const job = queue.then(() => new Promise<void>(resolve => setTimeout(resolve, 0))).then(() => {
      const [x, y, w, h] = spec.rects[0]!
      const scale = Math.min(224 / Math.max(...spec.rects.map(r => r[2]!)), 224 / Math.max(...spec.rects.map(r => r[3]!)))
      const crop = document.createElement('canvas'); crop.width = Math.max(1, Math.round(w! * scale)); crop.height = Math.max(1, Math.round(h! * scale))
      crop.getContext('2d')!.drawImage(image, x!, y!, w!, h!, 0, 0, crop.width, crop.height)
      clearEdgeSpecks(crop)
      const out = document.createElement('canvas'); out.width = out.height = 256
      out.getContext('2d')!.drawImage(crop, (256 - crop.width) / 2, 240 - crop.height)
      return out
    })
    queue = job.catch(() => {})
    return job
  }).catch(error => { thumbnails.delete(skin); throw error })
  thumbnails.set(skin, pending)
  return pending
}
