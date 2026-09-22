import { petQuotaIndex } from '../shared/petQuota'
import type { PiranhaSkin } from '../shared/types'
export type PiranhaAction = 'idle' | 'feed' | 'bloom' | 'tease' | 'pet' | 'sleep'
export type PiranhaLevel = 'full' | 'hungry' | 'low' | 'empty' | 'unknown'
export const PIRANHA_ACTIONS = [
  { id: 'feed', label: '投喂需求', hint: '递一张虚构纸条，啊呜一口', duration: 3200 },
  { id: 'bloom', label: '夸夸开花', hint: '你已经做得很好啦', duration: 2400 },
  { id: 'tease', label: '逗逗花', hint: '“这个很简单”……哼！', duration: 2600 },
  { id: 'pet', label: '摸摸花冠', hint: '轻轻碰一下，花瓣晃呀晃', duration: 1800 },
  { id: 'sleep', label: '合苞小憩', hint: '歇一会儿，醒来再继续', duration: null },
] as const
export interface PiranhaPlay { action: PiranhaAction; started: number }
export const piranhaIdle = (): PiranhaPlay => ({ action: 'idle', started: 0 })
export function piranhaLevel(percent: number | null): PiranhaLevel {
  const index = petQuotaIndex(percent, 4)
  return index === null ? 'unknown' : (['full', 'hungry', 'low', 'empty'] as const)[index]!
}
export function beginPiranha(action: PiranhaAction, now: number): PiranhaPlay { return action === 'idle' ? piranhaIdle() : { action, started: now } }
export function advancePiranha(play: PiranhaPlay, now: number): PiranhaPlay {
  const duration = PIRANHA_ACTIONS.find(a => a.id === play.action)?.duration
  return duration != null && now - play.started >= duration ? piranhaIdle() : play
}
export function piranhaPose(percent: number | null, action: PiranhaAction, elapsed = 0) {
  if (action === 'sleep') return 3
  if (action === 'feed') return elapsed < 900 ? 1 : 6
  if (action === 'tease') return 5
  if (action === 'pet' || action === 'bloom') return 4
  return ({ full: 0, hungry: 1, low: 2, empty: 3, unknown: 0 })[piranhaLevel(percent)]
}
export function piranhaFrame(percent: number | null, skin: PiranhaSkin, action: PiranhaAction = 'idle', elapsed = 0) {
  const pose = piranhaPose(percent, action, elapsed)
  if (skin === 'classic') return { atlas: 'character', frame: pose } as const
  const row = ['sakura', 'cactus', 'halloween', 'christmas'].indexOf(skin)
  // Costume poses retain hats and pots during interaction as well as quota changes.
  const column = pose === 6 ? 1 : pose === 4 ? 0 : pose === 5 ? 2 : pose
  return { atlas: 'costume', frame: Math.max(0, row) * 4 + column } as const
}
export const PIRANHA_MOODS: Record<PiranhaLevel, { title: string; speech: string }> = {
  full: { title: '花稳稳满', speech: '今天的快乐，盆满钵满。' },
  hungry: { title: '等一口需求', speech: '再来一条需求吧～我还饿着呢！' },
  low: { title: '蔫了，歇歇', speech: '今天嚼不动啦，慢一点也很好。' },
  empty: { title: '合苞休息', speech: '花苞合起来，陪你歇一歇。' },
  unknown: { title: '等风，也等你', speech: '先陪你待一会儿，额度还没同步。' },
}
