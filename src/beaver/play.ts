import { FINAL_FORM_PERCENT } from '../shared/petQuota'
export type BeaverAction = 'idle' | 'groom' | 'feed' | 'drink' | 'wood' | 'pet' | 'ball' | 'leaves' | 'bird' | 'celebrate' | 'rest'
export interface BeaverPlay { mode: BeaverAction; since: number; strokes: number; collected: number[] }
export const BEAVER_STATES = [
  { percent: 100, label: '元气满满', hint: '今天也要好好创造' },
  { percent: 75, label: '状态良好', hint: '还够啃一会儿！' },
  { percent: 50, label: '继续加油', hint: '一口一口，慢慢来' },
  { percent: 25, label: '有点累了', hint: '留一点力气给自己' },
  { percent: 20, label: '快撑不住', hint: '再啃一口，快坚持不住了' },
  { percent: 15, label: '休息时间', hint: '树倒了，今天收工啦' },
] as const
export const BEAVER_MOTTOS = { gentle: '少一点请求，多一点创意', create: '一口一口，啃出好点子', rest: '认真工作，也要认真休息' } as const
export function beaverLevel(percent: number | null) {
  if (percent === null || !Number.isFinite(percent)) return 0
  return percent > 75 ? 0 : percent > 50 ? 1 : percent > 25 ? 2 : percent > 20 ? 3 : percent > FINAL_FORM_PERCENT ? 4 : 5
}
export const beaverIdle = (): BeaverPlay => ({ mode: 'idle', since: 0, strokes: 0, collected: [] })
export const beginBeaver = (mode: BeaverAction, now: number): BeaverPlay => ({ mode, since: now, strokes: 0, collected: [] })
export const BEAVER_DURATIONS = { feed: 5600, drink: 5000, wood: 5200, pet: 2600, ball: 6200, bird: 5200, celebrate: 2400, rest: 7000 } as const
export function advanceBeaver(state: BeaverPlay, now: number, reduced = false): BeaverPlay {
  if (state.mode === 'leaves' && now - state.since >= 18000) return beaverIdle()
  if (state.mode === 'idle' || state.mode === 'groom' || state.mode === 'leaves') return state
  return now - state.since >= (reduced ? Math.min(1800, BEAVER_DURATIONS[state.mode]) : BEAVER_DURATIONS[state.mode]) ? beaverIdle() : state
}
// Grooming measures deliberate strokes across the fur, not cleaned surface cells.
export function groomStroke(state: BeaverPlay, distance: number, now: number): BeaverPlay {
  if (state.mode !== 'groom' || !Number.isFinite(distance) || distance <= 0) return state
  const strokes = state.strokes + Math.min(distance, .12)
  return strokes >= 1.5 ? beginBeaver('celebrate', now) : { ...state, strokes }
}
export function collectLeaf(state: BeaverPlay, id: number, now: number): BeaverPlay {
  if (state.mode !== 'leaves' || !Number.isInteger(id) || id < 0 || id > 2 || state.collected.includes(id)) return state
  const collected = [...state.collected, id]
  return collected.length === 3 ? beginBeaver('celebrate', now) : { ...state, collected }
}
export function beaverReply(message: string) {
  if (/累|困|烦|忙|难|压力/.test(message)) return '把肩膀放松一点吧。树可以慢慢啃，你也可以慢慢来。'
  if (/好|开心|完成|成功|喜欢/.test(message)) return '吱！替你开心。把今天的小小收获，藏进树洞里。'
  if (/再见|晚安|睡/.test(message)) return '晚安，我替你守着这棵树。明天见！'
  return '我听见啦。一口木头，一个点子，我在这里陪着你。'
}
export const BEAVER_HINTS: Record<BeaverAction, string> = {
  idle: '', groom: '按住毛发，来回梳一梳', feed: '吸溜——这一口好香', drink: '咕嘟咕嘟，歇口气', wood: '新木头收到，抱稳再啃！',
  pet: '摸摸头，收到你的喜欢啦', ball: '接住啦！再推回去', leaves: '点点飘落的三片叶子', bird: '啾啾——林间朋友来串门',
  celebrate: '舒服啦，谢谢你的照顾！', rest: '靠一会儿，灵感也需要休息',
}
