import { FINAL_FORM_PERCENT } from '../shared/petQuota'
export type FeiduduLevel = 'full' | 'tea' | 'tired' | 'low' | 'empty' | 'unknown'
export type FeiduduAction = 'idle' | 'pet' | 'tea' | 'cookie' | 'belly' | 'work' | 'wiggle' | 'rest'
export interface FeiduduPlay { action: FeiduduAction; startedAt: number }
export const FEIDUDU_LEVELS = {
  full: { frame: 0, label: '元气满满', speech: '上班很苦，但我很圆。', color: '#72a34c' },
  tea: { frame: 1, label: '还有点余量', speech: '摸鱼也很费力！', color: '#c49a2b' },
  tired: { frame: 2, label: '开始撑了', speech: '问题不大，我还能扛！', color: '#d68a40' },
  low: { frame: 3, label: '快不行了', speech: '再坚持一下…', color: '#d56f50' },
  empty: { frame: 4, label: '今日已躺平', speech: '我躺平了…', color: '#a48678' },
  unknown: { frame: 0, label: '安静陪着你', speech: '不管电量多少，我都陪着你。', color: '#a09077' },
} satisfies Record<FeiduduLevel, { frame: number; label: string; speech: string; color: string }>
export const FEIDUDU_ACTIONS = [
  { id: 'pet', label: '摸摸头', hint: '点点脑袋，收下一颗心', speech: '嘿嘿，被你摸得晕乎乎。', frame: 8, duration: 2400, icon: 'heart' },
  { id: 'tea', label: '请喝奶茶', hint: '快乐是珍珠的形状', speech: '吸溜——快乐加一！', frame: 1, duration: 4500, icon: 'tea' },
  { id: 'cookie', label: '投喂饼干', hint: '咔嚓，烦恼少一口', speech: '肚子圆圆，心情也圆圆。', frame: 5, duration: 4000, icon: 'cookie' },
  { id: 'belly', label: '摸摸肚子', hint: '翻个身，把肚皮交给你', speech: '舒服得不想起来啦～', frame: 7, duration: 3600, icon: 'hand' },
  { id: 'work', label: '陪你加班', hint: '你认真忙，我认真陪', speech: '别催了，我在加载中…', frame: 6, duration: null, icon: 'work' },
  { id: 'wiggle', label: '圆滚滚摇摆', hint: '胖一点，快乐多一点', speech: '生活有点挤，我扭一扭。', frame: 8, duration: 3000, icon: 'sparkle' },
  { id: 'rest', label: '一起躺平', hint: '休息，也是一件正经事', speech: '先摸鱼，再说！', frame: 3, duration: null, icon: 'moon' },
] as const
export function feiduduLevel(percent: number | null): FeiduduLevel {
  if (percent === null || !Number.isFinite(percent)) return 'unknown'
  return percent > 80 ? 'full' : percent > 60 ? 'tea' : percent > 20 ? 'tired' : percent > FINAL_FORM_PERCENT ? 'low' : 'empty'
}
export function feiduduIdle(): FeiduduPlay { return { action: 'idle', startedAt: 0 } }
export function beginFeidudu(action: FeiduduAction, now: number): FeiduduPlay { return action === 'idle' ? feiduduIdle() : { action, startedAt: now } }
export function advanceFeidudu(play: FeiduduPlay, now: number): FeiduduPlay {
  const definition = FEIDUDU_ACTIONS.find(item => item.id === play.action)
  return definition?.duration != null && now - play.startedAt >= definition.duration ? feiduduIdle() : play
}
export function feiduduFrame(percent: number | null, action: FeiduduAction = 'idle'): number {
  return FEIDUDU_ACTIONS.find(item => item.id === action)?.frame ?? FEIDUDU_LEVELS[feiduduLevel(percent)].frame
}
