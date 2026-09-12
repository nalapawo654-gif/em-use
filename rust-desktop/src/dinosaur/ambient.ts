import type { DinosaurLevel } from './play'
export const DINOSAUR_MOTIONS = {
  fly: { label: '长翅膀飞一圈', hint: '小翅膀准备好，桌角巡逻出发', speech: '摸鱼，也要飞得高一点！', duration: 9000 },
  phone: { label: '偷偷刷手机', hint: '掏出手机，划两下就收好', speech: '再看一条，就一条！', duration: 9200 },
  yawn: { label: '困困打哈欠', hint: '眯起眼睛，张嘴打个大哈欠', speech: '哈——欠，今天也辛苦啦。', duration: 4600 },
  look: { label: '左右看看', hint: '转转脑袋，看看你在忙什么', speech: '让我看看，有什么新鲜事？', duration: 4400 },
  stretch: { label: '举爪伸懒腰', hint: '举起小短手，舒展一下', speech: '伸个懒腰，继续慢慢来。', duration: 5200 },
} as const
export type DinosaurMotion = keyof typeof DINOSAUR_MOTIONS
export function dinosaurMotionPool(level: DinosaurLevel): DinosaurMotion[] {
  if (level === 'empty') return []
  if (level === 'low') return ['yawn', 'look']
  if (level === 'tired') return ['phone', 'yawn', 'look', 'stretch']
  return ['fly', 'phone', 'yawn', 'look', 'stretch']
}
export function chooseDinosaurMotion(level: DinosaurLevel, previous: DinosaurMotion | null, random = Math.random): DinosaurMotion | null {
  const pool = dinosaurMotionPool(level).filter(item => item !== previous)
  return pool[Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length))] ?? null
}
export function dinosaurMotionDelay(random = Math.random, first = false) {
  const r = Math.max(0, Math.min(1, random()))
  return first ? 4000 + 3000 * r : 9000 + 8000 * r
}
export function ease(value: number) { const p = Math.max(0, Math.min(1, value)); return p*p*p*(p*(p*6-15)+10) }
export function envelope(p: number) { return ease(p / .18) * ease((1-p) / .2) }
export function dinosaurFlight(p: number) {
  if (p <= 0 || p >= 1) return { x: 0, y: 0, scale: 1, angle: 0, wings: 0, flap: 0 }
  const air = ease((p-.12)/.15) * ease((.9-p)/.18)
  const orbit = Math.PI * 2 * ease((p-.25)/.48)
  return { x: Math.sin(orbit)*70*air, y: (-62+29*(1-Math.cos(orbit)))*air, scale: 1-.38*air,
    angle: Math.sin(orbit)*.19*air, wings: ease(p/.12)*ease((1-p)/.13), flap: Math.sin(p* Math.PI*2*15)*air }
}
export function dinosaurPhone(p: number) {
  const hold = ease((p-.1)/.16)*ease((.93-p)/.19)
  const swipe = envelope((p-.29)/.43) * Math.sin(p*Math.PI*2*6)
  return { hold, swipe, nod: Math.sin(p*Math.PI*2*2)*hold }
}
