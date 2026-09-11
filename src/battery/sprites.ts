export type BatteryAtlas = HTMLCanvasElement[]
let pending: Promise<BatteryAtlas> | undefined
export function batteryMatte(r: number, g: number, b: number): number {
  return Math.max(0, Math.min(1, (Math.min(r, b) - g - 45) / 100))
}
function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve,reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Battery artwork failed to load: ' + path)); image.src = import.meta.env.BASE_URL + 'assets/battery/' + path })
}
function split(image: HTMLImageElement, columns: number, rows: number) {
  const result: HTMLCanvasElement[] = [], width = image.width / columns, height = image.height / rows
  for (let index = 0; index < columns * rows; index++) {
    // The generated first-row shells extend slightly below a nominal quarter.
    // Explicit gutters keep their metal bases out of the hand/shoe sprites.
    const row = Math.floor(index / columns)
    const bounds = rows === 4 ? [[0, .28], [.30, .50], [.50, .75], [.75, 1]][row] : [row / rows, (row + 1) / rows]
    const sourceY = image.height * bounds[0], sourceHeight = image.height * (bounds[1] - bounds[0])
    const work = document.createElement('canvas'); work.width = Math.ceil(width); work.height = Math.ceil(sourceHeight)
    const ctx = work.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(image, index % columns * width, sourceY, width, sourceHeight, 0, 0, width, sourceHeight)
    const pixels = ctx.getImageData(0, 0, work.width, work.height)
    let left = work.width, top = work.height, right = 0, bottom = 0
    for (let y = 0; y < work.height; y++) for (let x = 0; x < work.width; x++) {
      const i = (y * work.width + x) * 4, d = pixels.data, matte = batteryMatte(d[i], d[i + 1], d[i + 2])
      d[i + 3] = Math.round(d[i + 3] * (1 - matte))
      if (matte > 0) { d[i] = Math.min(d[i], d[i + 1] + 45); d[i + 2] = Math.min(d[i + 2], d[i + 1] + 45) }
      if (d[i + 3] > 30) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y) }
    }
    ctx.putImageData(pixels, 0, 0)
    if (right <= left || bottom <= top) throw new Error('Battery atlas cell is empty')
    const sprite = document.createElement('canvas'); sprite.width = right - left + 1; sprite.height = bottom - top + 1
    sprite.getContext('2d')!.drawImage(work, left, top, sprite.width, sprite.height, 0, 0, sprite.width, sprite.height)
    result.push(sprite)
  }
  return result
}
export function loadBatteryAtlas(): Promise<BatteryAtlas> {
  if (!pending) pending = (async () => {
    const [base, extra, props] = await Promise.all([
      loadImage('fitness-atlas.png'), loadImage('energy-shells.png'),
      loadImage('fitness-props-v2.png'),
    ])
    return [...split(base, 4, 4), ...split(extra, 2, 1), ...split(props, 2, 2)]
  })().catch(error => { pending = undefined; throw error })
  return pending
}
