import { FINAL_FORM_PERCENT } from '../shared/petQuota'
export type CultivationAction = 'idle' | 'greet' | 'tea' | 'woodfish' | 'talisman' | 'comb' | 'incense' | 'peach'
export type CultivationLevel = 'full' | 'settling' | 'low' | 'empty' | 'unknown'
export const CULTIVATION_LEVELS = {
  full: { frame: 0, label: '仙气满满', speech: '区区小事，不在话下。' },
  settling: { frame: 1, label: '运功调息', speech: '有点累了…再运一运功。' },
  low: { frame: 2, label: '灵力微弱', speech: '道友，这个需求有点逆天…' },
  empty: { frame: 3, label: '今日收功', speech: '修为散尽…歇歇再战！' },
  unknown: { frame: 0, label: '静候仙缘', speech: '静候道友，连接今日灵力。' },
}
export const CULTIVATION_ACTIONS = [
  { id: 'tea', label: '递茶', hint: '一盏清茶，慢慢来', prop: 3, duration: 3000 },
  { id: 'woodfish', label: '敲木鱼', hint: '心静一点，烦恼少点', prop: 4, duration: 2400 },
  { id: 'talisman', label: '送符咒', hint: '依次点亮天地人三印', prop: 5, duration: 0 },
  { id: 'comb', label: '给他梳头', hint: '在头发上轻轻拖动', prop: 6, duration: 0 },
  { id: 'incense', label: '点香', hint: '一缕青烟，放松一下', prop: 2, duration: 5000 },
  { id: 'peach', label: '喂仙桃', hint: '今日也要开心一下', prop: 7, duration: 3000 },
] as const
export interface CultivationPlay { action: CultivationAction; since: number; progress: number; completedAt: number | null }
export function cultivationLevel(percent: number | null): CultivationLevel {
  if (percent === null || !Number.isFinite(percent)) return 'unknown'
  return percent > 60 ? 'full' : percent > 20 ? 'settling' : percent > FINAL_FORM_PERCENT ? 'low' : 'empty'
}
export function cultivationIdle(): CultivationPlay { return { action: 'idle', since: 0, progress: 0, completedAt: null } }
export function beginCultivation(action: CultivationAction, now: number): CultivationPlay { return { action, since: now, progress: 0, completedAt: null } }
export function lightSeal(play: CultivationPlay, index: number, now: number): CultivationPlay {
  if (play.action !== 'talisman' || play.completedAt !== null || index !== play.progress) return play
  const progress = play.progress + 1
  return { ...play, progress, completedAt: progress === 3 ? now : null }
}
export function combStroke(play: CultivationPlay, distance: number, now: number): CultivationPlay {
  if (play.action !== 'comb' || play.completedAt !== null || !Number.isFinite(distance) || distance <= 0 || distance > .3) return play
  const progress = Math.min(1.2, play.progress + distance)
  return { ...play, progress, completedAt: progress >= 1.2 - 1e-8 ? now : null }
}
export function advanceCultivation(play: CultivationPlay, now: number): CultivationPlay {
  if (play.completedAt !== null) return now - play.completedAt >= 1200 ? cultivationIdle() : play
  const duration = play.action === 'greet' ? 1800 : CULTIVATION_ACTIONS.find(a => a.id === play.action)?.duration
  return duration && now - play.since >= duration ? cultivationIdle() : play
}
