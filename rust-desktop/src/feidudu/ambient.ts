/** Ambient motion has no access to account data or the manual interaction state. */
export const FEIDUDU_MOTIONS = {
  eyes: { label: '眼珠滴溜溜', duration: 3000 },
  ears: { label: '抖抖耳朵', duration: 2300 },
  belly: { label: '自己揉肚子', duration: 4000 },
  yawn: { label: '打个小哈欠', duration: 3600 },
  blink: { label: '眨眨眼睛', duration: 1600 },
  nod: { label: '困倦点点头', duration: 3200 },
  stretch: { label: '伸个懒腰', duration: 3400 },
  foot: { label: '晃晃小脚', duration: 2700 },
  sniff: { label: '小鼻子嗅一嗅', duration: 1900 },
} as const
export type FeiduduMotion = keyof typeof FEIDUDU_MOTIONS
export function feiduduMotionPool(frame: number): FeiduduMotion[] {
  const quiet: FeiduduMotion[] = ['eyes', 'ears', 'blink', 'sniff']
  if (frame === 0 || frame === 1 || frame === 2) return [...quiet, 'belly', 'yawn', 'nod', 'stretch', 'foot']
  if (frame === 3) return [...quiet, 'yawn', 'nod']
  if (frame === 4) return quiet // The flattened pose stays exhausted.
  return []
}
export function chooseFeiduduMotion(frame: number, previous: FeiduduMotion | null, random = Math.random): FeiduduMotion | null {
  const pool = feiduduMotionPool(frame).filter(item => item !== previous)
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length))]! : null
}
export function feiduduMotionDelay(random = Math.random, first = false): number {
  return (first ? 3000 : 5000) + random() * (first ? 5000 : 8000)
}
export function motionEnvelope(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0
  const smooth = (x: number) => x * x * (3 - 2 * x)
  return smooth(Math.min(1, progress / .18)) * smooth(Math.min(1, (1 - progress) / .22))
}

/** Put the cup aside for gestures that need free hands; the quota is unchanged. */
export function feiduduAmbientFrame(frame: number, motion: FeiduduMotion): number {
  return frame === 1 && ['belly', 'yawn', 'stretch', 'foot'].includes(motion) ? 0 : frame
}
