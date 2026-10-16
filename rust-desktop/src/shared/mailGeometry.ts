/** Fit opaque artwork into its placement box, preserving the floor baseline. */
export function containMailRect(sourceWidth: number, sourceHeight: number, rect: { x: number; y: number; width: number; height: number }) {
  const scale = Math.min(rect.width / sourceWidth, rect.height / sourceHeight)
  const width = sourceWidth * scale, height = sourceHeight * scale
  return { x: rect.x + (rect.width - width) / 2, y: rect.y + rect.height - height, width, height }
}
