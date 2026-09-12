import { FINAL_FORM_PERCENT } from '../shared/petQuota'
export type LuckyCatLevel = 'full' | 'medium' | 'low' | 'empty' | 'unknown'
export type LuckyCatAction = 'idle' | 'fortune' | 'fish' | 'coffee' | 'work' | 'box' | 'gift' | 'blink' | 'stretch' | 'toss' | 'groom' | 'listen' | 'doze'
export interface LuckyCatPlay { action: LuckyCatAction; startedAt: number }
export const LUCKYCAT_LEVELS = {
  full: { label: '满量，躺平享受', speech: '稳！问题不大！', color: '#38aa75' },
  medium: { label: '认真工作，努力招财', speech: '继续搞！', color: '#e2aa37' },
  low: { label: '抱紧最后的小金币', speech: '只剩一点了…', color: '#ec7148' },
  empty: { label: '空碗求生，在线陪伴', speech: '救命…猫还在！', color: '#d85966' },
  unknown: { label: '等一等，正在看账本', speech: '有多少，等同步了才知道。', color: '#999184' },
} satisfies Record<LuckyCatLevel, { label: string; speech: string; color: string }>
export const LUCKYCAT_ACTIONS = [
  { id: 'fortune', label: '招招财', hint: '挥挥小爪，接住好心情', speech: '发财！先发个好心情！', duration: 4400, icon: 'coin' },
  { id: 'fish', label: '喂条小鱼', hint: '一口小鱼，猫猫满足', speech: '这条鱼，我就不客气啦！', duration: 4200, icon: 'fish' },
  { id: 'coffee', label: '续杯咖啡', hint: '举起咖啡，歇一小会', speech: '老板…咖啡续上了。', duration: 5600, icon: 'coffee' },
  { id: 'work', label: '认真赶工', hint: '敲敲键盘，陪你开工', speech: '加油！猫猫也在努力！', duration: 4600, icon: 'keyboard' },
  { id: 'box', label: '纸箱摸鱼', hint: '躲进纸箱，随时回来', speech: '摸鱼中，勿扰。', duration: null, icon: 'box' },
  { id: 'gift', label: '送个红包', hint: '收个小祝福，开心一下', speech: '福气收到了，谢谢你！', duration: 4400, icon: 'gift' },
  { id: 'blink', label: '眨眨眼', hint: '轻轻闭眼，再眨一下', speech: '看见你啦。', duration: 1800, icon: 'eye' },
  { id: 'stretch', label: '伸个懒腰', hint: '举起双爪，张嘴打个哈欠', speech: '啊——猫猫伸展开了！', duration: 5400, icon: 'stretch' },
  { id: 'toss', label: '抛接金子', hint: '抛起元宝，再稳稳接住', speech: '接住！这是猫猫的小玩具。', duration: 6200, icon: 'coin' },
  { id: 'groom', label: '蹭蹭小脸', hint: '抬起肉垫，揉揉脸颊', speech: '把小脸也整理一下。', duration: 4400, icon: 'hand' },
  { id: 'listen', label: '歪头听听', hint: '转转脑袋，听听动静', speech: '嗯？你叫我了吗？', duration: 3200, icon: 'ear' },
  { id: 'doze', label: '打个小盹', hint: '慢慢合眼，点点脑袋', speech: '就眯一小会儿…', duration: 5400, icon: 'moon' },
] as const
export function luckycatLevel(percent: number | null): LuckyCatLevel {
  if (percent === null || !Number.isFinite(percent)) return 'unknown'
  return percent > 60 ? 'full' : percent > 20 ? 'medium' : percent > FINAL_FORM_PERCENT ? 'low' : 'empty'
}
export function luckycatIdle(): LuckyCatPlay { return { action: 'idle', startedAt: 0 } }
export function beginLuckyCat(action: LuckyCatAction, now: number): LuckyCatPlay { return action === 'idle' ? luckycatIdle() : { action, startedAt: now } }
export function advanceLuckyCat(play: LuckyCatPlay, now: number): LuckyCatPlay {
  const action = LUCKYCAT_ACTIONS.find(item => item.id === play.action)
  return action?.duration != null && now - play.startedAt >= action.duration ? luckycatIdle() : play
}
export function luckycatFrame(percent: number | null, action: LuckyCatAction = 'idle'): number {
  if (action !== 'idle') return { fortune: 4, fish: 5, coffee: 6, work: 1, box: 7, gift: 4, blink: 4, stretch: 4, toss: 4, groom: 4, listen: 4, doze: 7 }[action]
  return { full: 0, medium: 1, low: 2, empty: 3, unknown: 1 }[luckycatLevel(percent)]
}
