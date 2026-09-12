import { FINAL_FORM_PERCENT } from '../shared/petQuota'
export type SkadiLevel = 'full' | 'medium' | 'low' | 'empty' | 'unknown'
export type SkadiAction = 'idle' | 'pet' | 'sing' | 'blade' | 'work' | 'sleep' | 'cat' | 'walk' | 'sit' | 'wave' | 'drink' | 'summon' | 'fish' | 'feed' | 'dance' | 'fly' | 'turn'
export interface SkadiPlay { action: SkadiAction; startedAt: number }
export const SKADI_LEVELS = {
  full: { label: '月光充盈', speech: '月色很好。今天，也陪着你。', color: '#9bbfea', glow: .7 },
  medium: { label: '潮声渐缓', speech: '不必着急，我会一直在这里。', color: '#afaed5', glow: .5 },
  low: { label: '夜色渐深', speech: '余量不多了。记得给自己留点休息。', color: '#dba5b7', glow: .28 },
  empty: { label: '静候新潮', speech: '留一点额度，一起等下一次潮汐。', color: '#8c94ab', glow: .16 },
  unknown: { label: '静候消息', speech: '额度还未确认，不过，我已经在了。', color: '#a2acbd', glow: .35 },
} satisfies Record<SkadiLevel, { label: string; speech: string; color: string; glow: number }>
export const SKADI_ACTIONS = [
  { id: 'pet', label: '轻轻摸头', hint: '摸摸头，让她安心一点', speech: '嗯……你的手，很温暖。', duration: 3000, icon: 'hand' },
  { id: 'sing', label: '听她哼唱', hint: '看音符随她的歌声轻轻浮起', speech: '这首歌，只唱给你听。', duration: 6000, icon: 'music' },
  { id: 'blade', label: '释放武器技能', hint: '使用当前装备，释放专属动效', speech: '别怕，月光会守着你。', duration: 4600, icon: 'sword' },
  { id: 'cat', label: '逗逗夜影', hint: '小黑猫也想陪你玩一会', speech: '夜影，来和他打个招呼。', duration: 3800, icon: 'cat' },
  { id: 'work', label: '陪你工作', hint: '托着脸颊，安静等你忙完', speech: '你忙你的。我在这里，哪儿也不去。', duration: null, icon: 'work' },
  { id: 'sleep', label: '晚安月汐', hint: '把今天，交给温柔的月亮', speech: '晚安。醒来以后，也要见到你。', duration: null, icon: 'moon' },
  { id: 'walk', label: '走一走', hint: '沿着桌角，轻轻走几个小步', speech: '陪我走一小段，好吗？', duration: 4800, icon: 'walk' },
  { id: 'sit', label: '安静坐下', hint: '坐在月光里，慢慢陪着你', speech: '这里刚好，能一直看见你。', duration: null, icon: 'sit' },
  { id: 'wave', label: '挥挥手', hint: '举起手，向你打个招呼', speech: '在这里。看见我了吗？', duration: 3200, icon: 'hand' },
  { id: 'drink', label: '一起喝茶', hint: '递一杯月光里的热茶', speech: '温度刚好，你也休息一下。', duration: 4500, icon: 'tea' },
  { id: 'summon', label: '召唤魔法', hint: '当前武器展开自己的魔法阵', speech: '以月色为名，回应我的呼唤。', duration: 5200, icon: 'sparkle' },
  { id: 'fish', label: '海边钓鱼', hint: '等鱼漂亮起，再点击提竿', speech: '嘘……等鱼漂轻轻动一下。', duration: 8000, icon: 'fish' },
  { id: 'feed', label: '喂一口点心', hint: '让她接过一枚小点心', speech: '留给我的？那我就收下了。', duration: 3600, icon: 'food' },
  { id: 'dance', label: '随月起舞', hint: '裙摆轻旋，踩着月光的拍子', speech: '要和我跳一支舞吗？', duration: 6000, icon: 'music' },
  { id: 'fly', label: '乘风飞行', hint: '长发与飘带，随风浮起来', speech: '别担心，很快就落在你身边。', duration: 5400, icon: 'wind' },
  { id: 'turn', label: '回眸看看', hint: '侧过身，看看你还在不在', speech: '嗯，你还在。', duration: 3400, icon: 'look' },
] as const
export function skadiLevel(percent: number | null): SkadiLevel {
  if (percent === null || !Number.isFinite(percent)) return 'unknown'
  return percent > 60 ? 'full' : percent > 20 ? 'medium' : percent > FINAL_FORM_PERCENT ? 'low' : 'empty'
}
export function skadiIdle(): SkadiPlay { return { action: 'idle', startedAt: 0 } }
export function beginSkadi(action: SkadiAction, now: number): SkadiPlay { return action === 'idle' ? skadiIdle() : { action, startedAt: now } }
export function advanceSkadi(play: SkadiPlay, now: number): SkadiPlay {
  const action = SKADI_ACTIONS.find(item => item.id === play.action)
  return action?.duration != null && now - play.startedAt >= action.duration ? skadiIdle() : play
}
export function skadiFrame(action: SkadiAction, percent: number | null): number {
  const frames = { idle: 0, pet: 1, sing: 2, blade: 3, sleep: 4, work: 5, cat: 1, walk: 0, sit: 5, wave: 3, drink: 2, summon: 3, fish: 3, feed: 1, dance: 3, fly: 3, turn: 0 }
  return action === 'idle' && ['low', 'empty'].includes(skadiLevel(percent)) ? 5 : frames[action]
}
