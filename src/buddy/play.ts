export type BuddyAction = 'idle' | 'feed' | 'drink' | 'pet' | 'clean' | 'play' | 'swat' | 'wag' | 'sleep' | 'shake' | 'rest' | 'inflate' | 'celebrate'
export interface BuddyPlay { mode: BuddyAction; since: number; cleaned: number[] }
export const BUDDY_STATES = [
  { percent: 100, label: '饱满', hint: '精神抖擞，干劲十足', speech: '当前状态还不错\n继续加油呀！' },
  { percent: 50, label: '略瘪', hint: '开始有点累了', speech: '忙里偷个小闲\n陪我歇一会儿吧' },
  { percent: 20, label: '明显瘪', hint: '需要及时补充', speech: '能量有点不够了\n记得留点余量呀' },
  { percent: 0, label: '瘫软', hint: '额度耗尽，休息一下', speech: '今天已经很努力了\n明天再一起出发' },
] as const
export function buddyLevel(percent: number | null) {
  if (percent === null || !Number.isFinite(percent)) return 0
  return percent > 60 ? 0 : percent > 25 ? 1 : percent > 0 ? 2 : 3
}
export const buddyIdle = (): BuddyPlay => ({ mode: 'idle', since: 0, cleaned: [] })
export const beginBuddy = (mode: BuddyAction, now: number): BuddyPlay => ({ mode, since: now, cleaned: [] })
export const durations: Record<Exclude<BuddyAction, 'idle' | 'clean'>, number> = { feed: 5800, drink: 6200, pet: 4200, play: 5600, swat: 5100, wag: 4000, sleep: 7600, shake: 3200, rest: 5400, inflate: 4800, celebrate: 3200 }
export function advanceBuddy(state: BuddyPlay, now: number, reducedMotion = false): BuddyPlay {
  if (state.mode === 'idle' || state.mode === 'clean') return state
  return now - state.since >= (reducedMotion ? Math.min(1800, durations[state.mode]) : durations[state.mode]) ? buddyIdle() : state
}
export const buddyCleanCells = Array.from({ length: 20 }, (_, i) => ({ x: .40 + (i % 5) * .075, y: .40 + Math.floor(i / 5) * .10 }))
export function scrubBuddy(state: BuddyPlay, x: number, y: number, now: number): BuddyPlay {
  if (state.mode !== 'clean' || !Number.isFinite(x) || !Number.isFinite(y)) return state
  const cleaned = new Set(state.cleaned)
  buddyCleanCells.forEach((p, i) => { if (Math.hypot(x - p.x, y - p.y) < .11) cleaned.add(i) })
  return cleaned.size >= 18 ? beginBuddy('celebrate', now) : { ...state, cleaned: [...cleaned] }
}
export const ACTION_LABELS: Record<BuddyAction, string> = {
  idle: '', feed: '嚼嚼青草，心情也饱饱的', drink: '咕嘟咕嘟，喝口水歇一歇', pet: '摸摸头，收到你的喜欢啦',
  clean: '按住拖动刷洗牛马', play: '踢踢球，活动一下', swat: '尾巴甩一甩，小蚊子快走开', wag: '开心得尾巴都藏不住啦',
  sleep: '嘘，让牛马打个小盹', shake: '抖一抖，烦恼都抖掉', rest: '撑不住啦，躺一小会儿',
  inflate: '呼——给自己鼓鼓劲（额度不变）', celebrate: '洗得亮晶晶，心情也更轻松',
}
