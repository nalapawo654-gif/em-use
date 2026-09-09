export type PlayMode = 'idle' | 'feed' | 'hide' | 'seek' | 'reveal' | 'clean' | 'treasure' | 'celebrate'
export interface PlayState { mode: PlayMode; since: number; cleaned: number[] }
export const idlePlay = (): PlayState => ({ mode: 'idle', since: 0, cleaned: [] })
export const cleanCells = Array.from({ length: 48 }, (_, i) => ({ x: .2 + (i % 8) * .085, y: .32 + Math.floor(i / 8) * .082 }))
export function startPlay(mode: PlayMode, now: number): PlayState { return { mode, since: now, cleaned: [] } }
export function advancePlay(state: PlayState, now: number): PlayState {
  const elapsed = now - state.since
  if (state.mode === 'hide' && elapsed >= 1100) return startPlay('seek', now)
  if (state.mode === 'seek' && elapsed >= 12000) return startPlay('reveal', now)
  const duration = { feed: 2800, reveal: 1500, treasure: 6500, celebrate: 1800 }[state.mode as 'feed' | 'reveal' | 'treasure' | 'celebrate']
  return duration && elapsed >= duration ? idlePlay() : state
}
export function wipeAt(state: PlayState, x: number, y: number, now: number): PlayState {
  if (state.mode !== 'clean' || !Number.isFinite(x) || !Number.isFinite(y)) return state
  const cleaned = new Set(state.cleaned)
  cleanCells.forEach((point, i) => { if (Math.hypot(x - point.x, y - point.y) < .095) cleaned.add(i) })
  if (cleaned.size >= 42) return startPlay('celebrate', now)
  return { ...state, cleaned: [...cleaned] }
}
export function waterTop(percent: number | null): number {
  if (percent === null || !Number.isFinite(percent)) return .84 - .65 * Math.pow(.68, .44)
  return .84 - .65 * Math.pow(Math.max(0, Math.min(100, percent)) / 100, .44)
}
