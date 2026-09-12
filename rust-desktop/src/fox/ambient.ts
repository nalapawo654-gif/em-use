import type { FoxLevel } from './play'

/** Quiet, self-contained gestures. No quota/account or manual-play mutations. */
export const FOX_MOTIONS = {
  blink: { label: '缓缓眨眼', duration: 1500 },
  groom: { label: '抬爪拂耳', duration: 5400 },
  listen: { label: '侧首听风', duration: 3800 },
  sniff: { label: '轻嗅空气', duration: 2700 },
  tail: { label: '舒卷尾尖', duration: 4400 },
  doze: { label: '垂眸小憩', duration: 4600 },
} as const
export type FoxMotion = keyof typeof FOX_MOTIONS
export function foxMotionPool(pose: FoxLevel): FoxMotion[] {
  if (pose === 'empty') return ['blink', 'doze']
  if (pose === 'low') return ['blink', 'listen', 'sniff', 'doze']
  if (pose === 'medium') return ['listen', 'sniff', 'tail', 'doze']
  return ['blink', 'groom', 'listen', 'sniff', 'tail', 'doze']
}
export function chooseFoxMotion(pose: FoxLevel, previous: FoxMotion | null, random = Math.random): FoxMotion {
  const pool = foxMotionPool(pose).filter(item => item !== previous)
  return pool[Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length))]!
}
export function foxMotionDelay(random = Math.random, first = false): number {
  const r = Math.max(0, Math.min(1, random()))
  return first ? 1800 + r * 1400 : 6500 + r * 6500
}
export function foxEase(value: number): number {
  const p = Math.max(0, Math.min(1, value))
  return Math.max(0, Math.min(1, p * p * p * (p * (p * 6 - 15) + 10)))
}
/** Zero speed/acceleration at rest, with a generous quiet hold in the middle. */
export function foxEnvelope(progress: number): number {
  return foxEase(progress / .3) * foxEase((1 - progress) / .3)
}
export function foxBlink(progress: number): number {
  // Eyelids close a little faster than they reopen; the second blink is gentle.
  return foxEase((progress - .17) / .13) * foxEase((.69 - progress) / .3)
}
export function foxGroomPose(progress: number) {
  if (progress <= 0 || progress >= 1) return { lift: 0, stroke: 0, head: 0, close: 0 }
  const lift = foxEase((progress - .08) / .27) * foxEase((.94 - progress) / .28)
  const stroke = foxEase((progress - .36) / .08) * foxEase((.72 - progress) / .08) * Math.sin((progress - .36) / .36 * Math.PI * 4)
  return { lift, stroke, head: foxEnvelope(progress) * .8, close: foxEase((progress - .18) / .15) * foxEase((.89 - progress) / .22) }
}
