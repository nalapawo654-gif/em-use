import { FINAL_FORM_PERCENT } from '../shared/petQuota'
import { DINOSAUR_MOTIONS, type DinosaurMotion } from './ambient'
export type DinosaurLevel = 'full' | 'tea' | 'tired' | 'low' | 'empty' | 'unknown'
export type DinosaurAction = 'idle' | 'pet' | 'tea' | 'cookie' | 'pillow' | 'work' | 'cheer' | 'rest' | DinosaurMotion
export interface DinosaurPlay { action: DinosaurAction; startedAt: number }
export const DINOSAUR_LEVELS = {
  full: { frame: 0, label: '元气满满', speech: '虽然是恐龙，但也要上班呀！', color: '#72a34c' },
  tea: { frame: 1, label: '还有点余量', speech: '摸鱼也很费力！', color: '#c49a2b' },
  tired: { frame: 2, label: '开始摆烂', speech: '让我再趴一会儿…', color: '#d68a40' },
  low: { frame: 3, label: '快不行了', speech: '再坚持一下…', color: '#d56f50' },
  empty: { frame: 4, label: '今日先躺平', speech: '先下线了…', color: '#a48678' },
  unknown: { frame: 0, label: '安静陪着你', speech: '小小的我，安静陪着你。', color: '#a09077' },
} satisfies Record<DinosaurLevel, { frame: number; label: string; speech: string; color: string }>
export const DINOSAUR_ACTIONS = [
  ...Object.entries(DINOSAUR_MOTIONS).map(([id, spec]) => ({ id: id as DinosaurMotion, ...spec, frame: 0, icon: id === 'phone' ? 'phone' as const : 'sparkle' as const })),
  { id: 'pet', label: '摸摸小脑袋', hint: '点点脑袋，收下一颗心', speech: '嘿嘿，被你摸得晕乎乎。', frame: 8, duration: 2400, icon: 'heart' },
  { id: 'tea', label: '奶茶摸鱼', hint: '快乐是珍珠的形状', speech: '吸溜——快乐加一！', frame: 1, duration: 4500, icon: 'tea' },
  { id: 'cookie', label: '咔嚓小饼干', hint: '咔嚓，烦恼少一口', speech: '肚子圆圆，心情也圆圆。', frame: 5, duration: 4000, icon: 'cookie' },
  { id: 'pillow', label: '抱紧小软垫', hint: '趴上橘子垫，暂停营业', speech: '这块软垫，被我承包啦。', frame: 2, duration: null, icon: 'hand' },
  { id: 'work', label: '假装很忙', hint: '你认真忙，我认真陪', speech: '别催了，我在加载中…', frame: 6, duration: null, icon: 'work' },
  { id: 'cheer', label: '元气蹦蹦', hint: '小短腿，也有大大的干劲', speech: '冲呀！小恐龙出动！', frame: 0, duration: 3000, icon: 'sparkle' },
  { id: 'rest', label: '盖毯打个盹', hint: '裹好小毯子，梦里再努力', speech: '别催了，我在梦里上班…', frame: 7, duration: null, icon: 'moon' },
] as const
export function dinosaurLevel(percent: number | null): DinosaurLevel {
  if (percent === null || !Number.isFinite(percent)) return 'unknown'
  return percent > 80 ? 'full' : percent > 60 ? 'tea' : percent > 20 ? 'tired' : percent > FINAL_FORM_PERCENT ? 'low' : 'empty'
}
export function dinosaurIdle(): DinosaurPlay { return { action: 'idle', startedAt: 0 } }
export function beginDinosaur(action: DinosaurAction, now: number): DinosaurPlay { return action === 'idle' ? dinosaurIdle() : { action, startedAt: now } }
export function advanceDinosaur(play: DinosaurPlay, now: number): DinosaurPlay {
  const definition = DINOSAUR_ACTIONS.find(item => item.id === play.action)
  return definition?.duration != null && now - play.startedAt >= definition.duration ? dinosaurIdle() : play
}
export function dinosaurFrame(percent: number | null, action: DinosaurAction = 'idle'): number {
  return DINOSAUR_ACTIONS.find(item => item.id === action)?.frame ?? DINOSAUR_LEVELS[dinosaurLevel(percent)].frame
}
