// Codex Pets jige-cxk v1: 192 × 208 cells, eight columns, nine rows.
// Source metadata and attribution: docs/design/basketball-jige/README.md.
const idle = { row: 0, frames: 6, loop: true, still: 0 }
const motions: Record<string, typeof idle> = {
  idle,
  aim: { row: 6, frames: 6, loop: true, still: 0 },
  shoot: { row: 4, frames: 5, loop: false, still: 2 },
  celebrate: { row: 4, frames: 5, loop: true, still: 2 },
  wave: { row: 3, frames: 4, loop: true, still: 2 },
  miss: { row: 5, frames: 8, loop: false, still: 1 },
}
export function chickenMotion(pose: string) { return motions[pose] ?? idle }
export function chickenFrame(pose: string, elapsed: number, gentle = false) {
  const motion = chickenMotion(pose)
  if (gentle) return motion.still
  const frame = Math.floor(Math.max(0, elapsed) / 120)
  return motion.loop ? frame % motion.frames : Math.min(frame, motion.frames - 1)
}
