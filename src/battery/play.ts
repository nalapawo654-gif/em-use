export type BatteryLevel = 'full' | 'bright' | 'steady' | 'tired' | 'low' | 'empty' | 'unknown'
export type BatteryAction = 'idle' | 'lift' | 'rope' | 'charge' | 'towel' | 'cheer' | 'rest' | 'taichi' | 'aerobics' | 'yoga'
export interface BatteryPlay { action: BatteryAction; since: number; reps: number; lastRep: number; completedAt: number | null }
export const LIFT_TARGET = 6
export const LIFT_INTERVAL = 900
export const BATTERY_LEVELS: Record<BatteryLevel, { label: string; speech: string; color: string }> = {
  full: { label: '元气蹦蹦跳', speech: '电量充足！再来一组！', color: '#439854' },
  bright: { label: '轻快小跑', speech: '今天也要，快乐流汗。', color: '#67a154' },
  steady: { label: '还能再练练', speech: '呼……有点累，但还能举。', color: '#c08c2c' },
  tired: { label: '坐着伸伸腿', speech: '休息一下，也是在进步。', color: '#d1833e' },
  low: { label: '真的动不啦', speech: '电量告急……陪我歇歇。', color: '#c45e4c' },
  empty: { label: '今日已躺平', speech: '电量耗尽，先好好休息。', color: '#a36860' },
  unknown: { label: '等待电量信号', speech: '热身准备好，等一个信号。', color: '#82908a' },
}
export function batteryLevel(percent: number | null): BatteryLevel {
  if (percent === null || !Number.isFinite(percent)) return 'unknown'
  return percent > 75 ? 'full' : percent > 50 ? 'bright' : percent > 25 ? 'steady' : percent > 10 ? 'tired' : percent > 0 ? 'low' : 'empty'
}
export const BATTERY_EXERCISES: readonly BatteryAction[] = ['lift', 'rope', 'taichi', 'aerobics', 'yoga']
export function isBatteryExercise(action: BatteryAction) { return BATTERY_EXERCISES.includes(action) }
export function canExercise(percent: number | null) { return percent !== null && Number.isFinite(percent) && percent > 0 }
export function batteryIdle(): BatteryPlay { return { action: 'idle', since: 0, reps: 0, lastRep: -Infinity, completedAt: null } }
export function beginBattery(action: BatteryAction, now: number, percent: number | null): BatteryPlay {
  if (isBatteryExercise(action) && !canExercise(percent)) return batteryIdle()
  return { ...batteryIdle(), action, since: now }
}
export function liftBattery(play: BatteryPlay, now: number): BatteryPlay {
  if (play.action !== 'lift' || play.completedAt !== null || Number.isFinite(play.lastRep)) return play
  // Count at the end of the full lift, never on the initial press.
  return { ...play, lastRep: now }
}
export const BATTERY_DURATIONS: Partial<Record<BatteryAction, number>> = { rope: 6000, charge: 6400, taichi: 12000, aerobics: 10000, yoga: 14000, towel: 3200, cheer: 2000 }
export function advanceBattery(play: BatteryPlay, now: number, percent: number | null): BatteryPlay {
  if (isBatteryExercise(play.action) && !canExercise(percent)) return batteryIdle()
  if (play.completedAt !== null) return now - play.completedAt >= 1800 ? batteryIdle() : play
  if (play.action === 'lift' && Number.isFinite(play.lastRep) && now - play.lastRep >= LIFT_INTERVAL) {
    const reps = Math.min(LIFT_TARGET, play.reps + 1)
    return { ...play, reps, lastRep: -Infinity, completedAt: reps === LIFT_TARGET ? now : null }
  }
  const duration = BATTERY_DURATIONS[play.action]
  return duration !== undefined && now - play.since >= duration ? batteryIdle() : play
}
