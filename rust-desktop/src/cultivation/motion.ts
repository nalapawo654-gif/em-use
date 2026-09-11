import type { CultivationSkin } from '../shared/types'

// Face centre landmarks in the authored 512px cells. The atlas columns are
// evenly spaced, but the characters inside them are not. Translate, never zoom.
const faceCentres: Record<CultivationSkin, readonly number[]> = {
  classic: [270,254,236,270,254,237],
  azure: [268,263,278,270,262,254],
  astral: [254,250,252,254,248,253],
  crimson: [274,266,263,274,266,264],
}
export function cultivatorFrameOffset(skin: CultivationSkin, frame: number): number {
  return (256 - (faceCentres[skin][frame] ?? 256)) / 512
}

// A seated character is not a breathing balloon. Keep the face, chest and seat
// fixed; only rotate the outer forearms/sleeves around their shoulder joints.
const smooth = (a: number, b: number, n: number) => {
  const t = Math.max(0, Math.min(1, (n - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export function cultivatorVertex(x: number, y: number, frame: number, seconds: number, strength = 1): [number, number] {
  if (strength === 0 || y >= .87 || (x >= .32 && x <= .68)) return [x, y]
  const raised = frame === 5
  const side = x < .5 ? -1 : 1
  const outer = side < 0 ? 1 - smooth(.25, .32, x) : smooth(.68, .75, x)
  const edge = smooth(.03, .10, x) * (1 - smooth(.90, .97, x))
  const arm = smooth(raised ? .08 : .55, raised ? .30 : .64, y) * (1 - smooth(.78, .87, y))
  const angle = Math.sin(seconds * 1.25) * (raised ? .03 : .035) * side * outer * edge * arm * strength
  const pivotX = side < 0 ? .36 : .64, pivotY = .59
  const dx = x - pivotX, dy = y - pivotY, c = Math.cos(angle), s = Math.sin(angle)
  return [pivotX + dx * c - dy * s, pivotY + dx * s + dy * c]
}
