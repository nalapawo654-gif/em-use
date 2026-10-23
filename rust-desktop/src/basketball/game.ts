import { petQuotaIndex } from '../shared/petQuota'

export const COURT = { width: 440, height: 440, gravity: 500, floor: 338, radius: 8, rimY: 176, left: 318, right: 362, boardX: 378, boardTop: 102, boardBottom: 196 } as const
export const DISTANCES = [
  { label: '篮下近投', x: 238, points: 2 },
  { label: '中距离', x: 184, points: 3 },
  { label: '三分线外', x: 130, points: 4 },
  { label: '超远距离', x: 78, points: 5 },
] as const
export type Point = { x: number; y: number }
export type ShotKind = 'swish' | 'bank' | 'rim' | 'miss'
export type Ball = Point & { vx: number; vy: number; elapsed: number; rim: boolean; board: boolean; scored: boolean; scoredAt: number | null; groundAt: number | null; done: boolean }
export type Round = { level: number; practice: boolean; shots: number; score: number; hits: number; swishes: number; streak: number; best: number; results: ShotKind[] }
export function station(percent: number | null) { return petQuotaIndex(percent, 4) }
export function origin(level: number): Point { return { x: DISTANCES[level]!.x, y: 278 } }
export function newRound(percent: number | null): Round {
  const level = station(percent)
  return { level: level ?? 1, practice: level === null, shots: 0, score: 0, hits: 0, swishes: 0, streak: 0, best: 0, results: [] }
}
export function velocity(angle: number, power: number): Point {
  const radians = Math.max(20, Math.min(85, angle)) * Math.PI / 180
  const speed = Math.max(120, Math.min(570, power))
  return { x: Math.cos(radians) * speed, y: -Math.sin(radians) * speed }
}
export function aimFromPull(dx: number, dy: number) {
  return { angle: Math.max(20, Math.min(85, Math.atan2(Math.max(0, dy), Math.max(0, -dx)) * 180 / Math.PI)), power: Math.max(120, Math.min(570, Math.hypot(dx, dy) * 7)) }
}
export function launch(level: number, angle: number, power: number): Ball {
  const v = velocity(angle, power)
  return { ...origin(level), vx: v.x, vy: v.y, elapsed: 0, rim: false, board: false, scored: false, scoredAt: null, groundAt: null, done: false }
}
// Every caller uses the same small physics steps, independent of display refresh rate.
export function stepBall(input: Ball, seconds: number): Ball {
  const b = { ...input }
  let remaining = Math.max(0, Math.min(seconds, .1))
  while (remaining > 1e-9 && !b.done) {
    const dt = Math.min(remaining, 1 / 240); remaining -= dt
    const previous = { x: b.x, y: b.y }
    b.elapsed += dt; b.x += b.vx * dt; b.y += b.vy * dt + COURT.gravity * dt * dt / 2; b.vy += COURT.gravity * dt
    const r = COURT.radius
    // Backboard is a solid capsule-like rectangle; collide from either side, including its ends.
    const nearestX = Math.max(COURT.boardX, Math.min(COURT.boardX + 6, b.x))
    const nearestY = Math.max(COURT.boardTop, Math.min(COURT.boardBottom, b.y))
    const bx = b.x - nearestX, by = b.y - nearestY, bd = Math.hypot(bx, by)
    if (bd < r) {
      const nx = bd > 1e-6 ? bx / bd : previous.x < COURT.boardX ? -1 : 1, ny = bd > 1e-6 ? by / bd : 0
      b.x = nearestX + nx * r; b.y = nearestY + ny * r
      const dot = b.vx * nx + b.vy * ny
      if (dot < 0) { b.vx -= 1.78 * dot * nx; b.vy -= 1.78 * dot * ny; b.board = true }
    }
    for (const x of [COURT.left, COURT.right]) {
      const dx = b.x - x, dy = b.y - COURT.rimY, distance = Math.hypot(dx, dy), limit = r + 3
      if (distance < limit) {
        const nx = distance > 1e-6 ? dx / distance : 0, ny = distance > 1e-6 ? dy / distance : -1
        b.x = x + nx * limit; b.y = COURT.rimY + ny * limit
        const dot = b.vx * nx + b.vy * ny
        if (dot < 0) { b.vx -= 1.66 * dot * nx; b.vy -= 1.66 * dot * ny; b.rim = true }
      }
    }
    if (!b.scored && b.groundAt === null && previous.y < COURT.rimY && b.y >= COURT.rimY && b.vy > 0) {
      const crossingX = previous.x + (b.x - previous.x) * (COURT.rimY - previous.y) / (b.y - previous.y)
      if (crossingX > COURT.left + r && crossingX < COURT.right - r) { b.scored = true; b.scoredAt = b.elapsed }
    }
    if (b.y > COURT.floor - r) {
      b.y = COURT.floor - r
      if (b.vy > 0) { b.vy *= -.45; b.vx *= .72; b.groundAt ??= b.elapsed }
    }
    b.done = b.elapsed > 5 || b.x < -r * 2 || b.x > COURT.width + r * 2 || (b.scoredAt !== null && b.elapsed - b.scoredAt > .6) || (b.groundAt !== null && b.elapsed - b.groundAt > .5)
  }
  return b
}
export function shotKind(ball: Ball): ShotKind { return !ball.scored ? 'miss' : ball.rim ? 'rim' : ball.board ? 'bank' : 'swish' }
export function finishShot(round: Round, ball: Ball): Round {
  if (!ball.done || round.shots >= 10) return round
  const kind = shotKind(ball), hit = kind !== 'miss', streak = hit ? round.streak + 1 : 0
  return { ...round, shots: round.shots + 1, score: round.score + (hit ? DISTANCES[round.level]!.points + (kind === 'swish' ? 1 : 0) : 0), hits: round.hits + Number(hit), swishes: round.swishes + Number(kind === 'swish'), streak, best: Math.max(round.best, streak), results: [...round.results, kind] }
}
export function previewArc(level: number, angle: number, power: number): Point[] {
  const start = origin(level), v = velocity(angle, power)
  return Array.from({ length: 9 }, (_, i) => { const t = i * .035; return { x: start.x + v.x * t, y: start.y + v.y * t + COURT.gravity * t * t / 2 } })
}
