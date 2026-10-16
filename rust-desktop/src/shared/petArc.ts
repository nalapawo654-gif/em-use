/** Percentage geometry for the crescent. Buttons use actual clipped hit regions;
 * the centre remains transparent to the shared window/character gestures. */
export function arcSegment(start: number, end: number, inset = 0, caps: { start?: boolean; end?: boolean } = {}) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new RangeError('Invalid arc segment')
  const point = (angle: number, outer: boolean) => {
    const a = angle * Math.PI / 180
    return [42 + (outer ? 53 - inset : 40 + inset) * Math.cos(a), 44 + (outer ? 41 - inset : 31 + inset) * Math.sin(a)]
  }
  const steps = Math.max(8, Math.ceil((end - start) / 2))
  const cap = (angle: number, atEnd: boolean) => {
    const outer = point(angle, true), inner = point(angle, false)
    const cx = (outer[0]! + inner[0]!) / 2, cy = (outer[1]! + inner[1]!) / 2
    const dx = (outer[0]! - inner[0]!) / 2, dy = (outer[1]! - inner[1]!) / 2
    return Array.from({ length: 13 }, (_, i) => {
      const t = (atEnd ? 0 : Math.PI) + Math.PI * i / 12
      return [cx + dx * Math.cos(t) - dy * Math.sin(t), cy + dy * Math.cos(t) + dx * Math.sin(t)]
    })
  }
  const points = Array.from({ length: steps + 1 }, (_, i) => point(start + (end - start) * i / steps, true))
    .concat(caps.end ? cap(end, true) : [])
    .concat(Array.from({ length: steps + 1 }, (_, i) => point(end - (end - start) * i / steps, false)))
    .concat(caps.start ? cap(start, false) : [])
  const left = Math.min(...points.map(p => p[0]!)), top = Math.min(...points.map(p => p[1]!))
  const width = Math.max(...points.map(p => p[0]!)) - left, height = Math.max(...points.map(p => p[1]!)) - top
  const angle = (start + end) / 2 * Math.PI / 180
  return {
    left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
    'clip-path': `polygon(${points.map(([x, y]) => `${(x! - left) / width * 100}% ${(y! - top) / height * 100}%`).join(',')})`,
    '--content-x': `${(42 + 46.5 * Math.cos(angle) - left) / width * 100}%`,
    '--content-y': `${(44 + 36 * Math.sin(angle) - top) / height * 100}%`,
  }
}

export function arcButtonStyle(index: number, count: number, start: number, end: number, caps: { start?: boolean; end?: boolean } = {}) {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 0 || index >= count) throw new RangeError('Invalid arc button')
  const step = (end - start) / count
  return arcSegment(start + step * index + .35, start + step * (index + 1) - .35, .32, caps)
}
