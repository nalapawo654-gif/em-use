import { BEAVER_DURATIONS, type BeaverAction } from './play'
import { beaverAppearance } from './appearance'
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }
export const BEAVER_APPROACH = 800
export const BEAVER_RETURN = 700
/** All articulated parts and held props share this clock and recovery envelope. */
export function sampleBeaverMotion(action: BeaverAction, elapsed: number, clock: number, level: number, reduced = false) {
  const appearance = beaverAppearance(level)
  const duration = action in BEAVER_DURATIONS ? BEAVER_DURATIONS[action as keyof typeof BEAVER_DURATIONS] : action === 'leaves' ? 18000 : Infinity
  const end = reduced ? Math.min(1800, duration) : duration
  const resting = action === 'rest' || (level === 5 && action === 'idle')
  const amount = action === 'idle' || resting ? 0 : reduced ? (elapsed < end ? 1 : 0) : smooth(elapsed / BEAVER_APPROACH) * smooth((end - elapsed) / BEAVER_RETURN)
  const phase = action === 'idle' || resting ? 'idle' : elapsed < BEAVER_APPROACH ? 'prepare' : elapsed > end - BEAVER_RETURN ? 'recover' : 'perform'
  // Idle uses the global clock so starting/cancelling an action cannot restart its gnaw loop.
  const cycle = clock / (135 + level * 35)
  const idleChew = resting || reduced ? 0 : (Math.sin(cycle) + 1) / 2
  const activeChew = reduced ? 0 : (Math.sin(elapsed / 120) + 1) / 2
  const eating = action === 'feed' || action === 'wood'
  const chew = idleChew * (1 - amount) + (eating ? activeChew * amount : 0)
  const bob = reduced ? 0 : Math.sin(clock / 330)
  const happy = action === 'pet' || action === 'groom' || action === 'celebrate'
  return {
    phase, amount, resting, level, bodyScale: appearance.bodyScale * (1 - amount) + .98 * amount, strain: appearance.strain * (1 - amount), time: action === 'idle' ? clock : elapsed,
    x: 40 - 65 * amount,
    y: reduced || amount === 0 ? 0 : -Math.sin(amount * Math.PI) * 7 + (action === 'celebrate' ? -Math.abs(bob) * 15 * amount : 0),
    head: (.035 * Math.sin(cycle)) * (reduced || resting ? 0 : 1 - amount) + amount * (action === 'drink' ? -.24 + (reduced ? 0 : Math.sin(elapsed / 190) * .025) : action === 'feed' ? .2 : action === 'ball' ? .28 + bob * .08 : action === 'bird' ? -.2 : happy ? -.1 + bob * .07 : .09),
    headX: (reduced || resting ? 0 : idleChew * 5) * (1 - amount),
    headY: (appearance.headDrop * (1 - amount * .7) + (action === 'feed' ? 15 : happy ? -8 : 0) * amount),
    jaw: chew * 9 + (action === 'drink' ? amount * (3 + (reduced ? 0 : Math.sin(elapsed / 190) * 2)) : 0), chew,
    breathe: reduced ? 0 : Math.sin(clock / 850) * .006,
    tail: reduced ? 0 : Math.sin(clock / 700) * .035 * (happy ? 1 - amount : 1) + (happy ? Math.sin(clock / 130) * .16 * amount : 0),
    paw: reduced ? 0 : bob * amount * (action === 'ball' ? 25 : happy || action === 'leaves' || action === 'bird' ? 10 : 2),
    propLift: amount, chips: !reduced && !resting && (action === 'idle' || action === 'wood'),
  }
}
export type BeaverMotion = ReturnType<typeof sampleBeaverMotion>
/** Mouth anchor in the same coordinate space as the head. Props never use separate CSS timing. */
export function beaverMouth(m: BeaverMotion) {
  const x = 91, y = 38
  return { x: 334 + m.headX + x * Math.cos(m.head) - y * Math.sin(m.head), y: 210 + m.headY + x * Math.sin(m.head) + y * Math.cos(m.head) }
}
