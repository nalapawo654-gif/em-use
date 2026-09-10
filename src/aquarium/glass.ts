// Separate the pale studio backdrop from the daytime glass once at load time.
// Keep the original reflections, colored edges, plants and opaque gravel.
export function prepareDayGlass(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height), data = frame.data
  const smooth = (a: number, b: number, n: number) => { const t = Math.max(0, Math.min(1, (n - a) / (b - a))); return t * t * (3 - 2 * t) }
  for (let y = 0; y < canvas.height * .82; y++) {
    const bg = (y * canvas.width + 2) * 4
    const red = data[bg], green = data[bg + 1], blue = data[bg + 2]
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4
      const contrast = Math.max(Math.abs(data[i] - red), Math.abs(data[i + 1] - green), Math.abs(data[i + 2] - blue))
      const reflection = smooth(242, 254, Math.min(data[i], data[i + 1], data[i + 2]))
      const opacity = Math.max(.08, smooth(5, 65, contrast), reflection * .95, smooth(.73, .82, y / canvas.height))
      data[i + 3] = Math.round(data[i + 3] * opacity)
    }
  }
  ctx.putImageData(frame, 0, 0)
  return canvas
}
