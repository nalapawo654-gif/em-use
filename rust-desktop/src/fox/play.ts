import { FINAL_FORM_PERCENT } from '../shared/petQuota'
export type FoxLevel = 'full' | 'medium' | 'low' | 'empty' | 'unknown'
export type FoxAction = 'idle' | 'tail' | 'paper' | 'butterfly' | 'bloom' | 'rest'
export interface FoxPlay { action: FoxAction; startedAt: number }
export const FOX_LEVELS = {
  full: { label: '元气满满！', speech: '留一点墨，画一点喜欢。', color: '#688361' },
  medium: { label: '还有点墨～', speech: '忙里偷闲，也要留白。', color: '#b39758' },
  low: { label: '别看，省着呢。', speech: '本人含墨量不足。', color: '#c06b50' },
  empty: { label: '不是消失，是留白。', speech: '不是消失，是留白。', color: '#82817b' },
  unknown: { label: '安静等一等', speech: '墨有多少，等一等就知道。', color: '#8b918b' },
} satisfies Record<FoxLevel, { label: string; speech: string; color: string }>
export const FOX_ACTIONS = [
  { id: 'tail', label: '摸摸尾巴', hint: '摸一下，批个「阅」', speech: '嗯，朕已阅。', duration: 2800, icon: 'hand' },
  { id: 'paper', label: '递张纸条', hint: '加班？一尾巴涂黑。', speech: '加班？我先涂掉了。', duration: 4200, icon: 'paper' },
  { id: 'butterfly', label: '追一只蝶', hint: '抬起头，偷一点闲', speech: '有只小蝴蝶，替我分个心。', duration: 4800, icon: 'butterfly' },
  { id: 'bloom', label: '舒展墨尾', hint: '伸个懒腰，墨色舒展', speech: '一笔一画，慢慢来。', duration: 3200, icon: 'sparkle' },
  { id: 'rest', label: '留白一会', hint: '缩成墨团，安静陪你', speech: '留一点墨，留一点自己。', duration: null, icon: 'moon' },
] as const
export function foxLevel(percent: number | null): FoxLevel {
  if (percent === null || !Number.isFinite(percent)) return 'unknown'
  return percent > 60 ? 'full' : percent > 20 ? 'medium' : percent > FINAL_FORM_PERCENT ? 'low' : 'empty'
}
export function foxIdle(): FoxPlay { return { action: 'idle', startedAt: 0 } }
export function beginFox(action: FoxAction, now: number): FoxPlay { return action === 'idle' ? foxIdle() : { action, startedAt: now } }
export function advanceFox(play: FoxPlay, now: number): FoxPlay {
  const action = FOX_ACTIONS.find(item => item.id === play.action)
  return action?.duration != null && now - play.startedAt >= action.duration ? foxIdle() : play
}
export function foxPose(percent: number | null, action: FoxAction = 'idle'): FoxLevel {
  return action === 'rest' ? 'empty' : action !== 'idle' ? 'full' : foxLevel(percent)
}
