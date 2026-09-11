export type HamsterLevel = 'full' | 'working' | 'low' | 'empty' | 'unknown'
export type HamsterAction = 'idle' | 'feed' | 'wheel' | 'sleep' | 'pet' | 'groom' | 'bell' | 'tease' | 'coffee' | 'cat-yawn' | 'cat-nap' | 'cat-snack'
export interface HamsterPlay { action: HamsterAction; since: number; turns: number; lastTap: number; completedAt: number | null }
export function hamsterLevel(percent: number | null): HamsterLevel {
  if (percent === null || !Number.isFinite(percent)) return 'unknown'
  return percent > 60 ? 'full' : percent > 10 ? 'working' : percent > 0 ? 'low' : 'empty'
}
export const HAMSTER_LEVELS: Record<HamsterLevel, { label: string; speech: string }> = {
  full: { label: '活力满满', speech: '小小的身体，大大的能量！' },
  working: { label: '努力发电', speech: '鼠鼠还在努力，慢慢来～' },
  low: { label: '鼠鼠累了', speech: '鼠鼠也有极限…歇口气。' },
  empty: { label: '暂停营业', speech: '今日下班，等额度更新啦。' },
  unknown: { label: '等待额度', speech: '鼠鼠已就位，等一个信号。' },
}
export const WHEEL_TARGET = 6
export function hamsterIdle(): HamsterPlay { return { action: 'idle', since: 0, turns: 0, lastTap: -Infinity, completedAt: null } }
export function beginHamster(action: HamsterAction, now: number): HamsterPlay { return { ...hamsterIdle(), action, since: now } }
export function tapHamsterWheel(play: HamsterPlay, now: number): HamsterPlay {
  if (play.action !== 'wheel' || play.completedAt !== null || now - play.lastTap < 180) return play
  const turns = Math.min(WHEEL_TARGET, play.turns + 1)
  return { ...play, turns, lastTap: now, completedAt: turns === WHEEL_TARGET ? now : null }
}
export const HAMSTER_DURATIONS: Partial<Record<HamsterAction, number>> = { feed: 3200, pet: 1500, groom: 4500, bell: 2400, tease: 4200, coffee: 3400, 'cat-yawn': 2600, 'cat-nap': 9000, 'cat-snack': 4800 }
export function advanceHamster(play: HamsterPlay, now: number): HamsterPlay {
  const duration = HAMSTER_DURATIONS[play.action]
  if ((duration !== undefined && now - play.since >= duration) || (play.completedAt !== null && now - play.completedAt >= 900)) return hamsterIdle()
  return play
}
