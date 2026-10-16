/** Canvas actors need no PNG copies; DOM actors encode only the poses they use. */
export function lazyFrameUrls(frames: Pick<HTMLCanvasElement, 'toDataURL'>[]): string[] {
  const urls: string[] = new Array(frames.length)
  frames.forEach((frame, index) => {
    let encoded: string | undefined
    Object.defineProperty(urls, index, { enumerable: true, get: () => encoded ??= frame.toDataURL() })
  })
  return urls
}
