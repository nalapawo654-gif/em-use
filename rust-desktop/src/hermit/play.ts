import { petQuotaIndex } from '../shared/petQuota'
export type HermitAction = 'idle' | 'knock' | 'tease' | 'sleep' | 'peek' | 'tidy' | 'stretch' | 'doze' | 'accessory'
export interface HermitPlay { action: HermitAction; started: number; catches: number; lastCatch: number }
export const hermitIdle = (): HermitPlay => ({ action: 'idle', started: 0, catches: 0, lastCatch: -Infinity })
export function beginHermit(action: HermitAction, now: number): HermitPlay { return { ...hermitIdle(), action, started: now } }
const durations: Partial<Record<HermitAction, number>> = { knock: 1500, peek: 2500, tidy: 2600, stretch: 2400, doze: 4000, accessory: 1500 }
export function advanceHermit(play: HermitPlay, now: number): HermitPlay {
  const duration = durations[play.action]
  if (duration !== undefined && now - play.started >= duration || play.action === 'tease' && play.catches === 3 && now - play.lastCatch >= 1000) return hermitIdle()
  return play
}
/** One release is one attempt. Call only after clearing the captured pointer. */
export function catchFeather(play: HermitPlay, now: number, valid: boolean): HermitPlay {
  if (!valid || play.action !== 'tease' || play.catches >= 3 || now - play.lastCatch < 300) return play
  return { ...play, catches: play.catches + 1, lastCatch: now }
}
export function inCatchZone(x: number, y: number) { return Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x - .65, y - .43) <= .17 }
export function hermitFrame(percent: number | null, play: HermitPlay, now: number): number {
  if (play.action === 'sleep' || play.action === 'doze') return 3
  if (play.action === 'tease') return play.catches === 3 || now - play.lastCatch < 650 ? 5 : 4
  if (play.action === 'knock' || play.action === 'peek') return now - play.started < 350 ? 1 : 4
  if (play.action === 'stretch') return 5
  if (play.action === 'tidy' || play.action === 'accessory') return 1
  return petQuotaIndex(percent, 4) ?? 1
}
export const isMainHermitAction = (action: HermitAction) => ['knock', 'tease', 'sleep', 'accessory'].includes(action)
