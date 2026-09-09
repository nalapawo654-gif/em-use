export type Corner = 'nw' | 'ne' | 'sw' | 'se'
export type WindowGesture = 'move' | Corner
export interface Bounds { x: number; y: number; width: number; height: number }
export const PRESET_WIDTHS = { standard: 440, compact: 300, mini: 190 }
export function fitBowl(bounds: Bounds, area: Bounds): Bounds {
  const width = Math.round(Math.max(1, Math.min(Math.max(180, bounds.width), 800, area.width, area.height)))
  return { x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))), y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - width))), width, height: width }
}
export function gestureBounds(start: Bounds, dx: number, dy: number, mode: WindowGesture, area: Bounds): Bounds {
  if (mode === 'move') return fitBowl({ ...start, x: start.x + dx, y: start.y + dy }, area)
  const west = mode.includes('w'), north = mode.includes('n')
  const delta = ((west ? -dx : dx) + (north ? -dy : dy)) / 2
  const anchorX = west ? start.x + start.width : start.x, anchorY = north ? start.y + start.height : start.y
  const max = Math.min(west ? anchorX - area.x : area.x + area.width - anchorX, north ? anchorY - area.y : area.y + area.height - anchorY)
  const width = Math.round(Math.min(Math.max(180, start.width + delta), 800, Math.max(1, max)))
  return fitBowl({ x: west ? anchorX - width : anchorX, y: north ? anchorY - width : anchorY, width, height: width }, area)
}
