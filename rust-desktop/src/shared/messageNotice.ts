import type { MessageItem, MessageState, Scene } from './types'
export const MESSAGE_PERSONAS: Record<Scene, { object: string; color: string; motion: string }> = {
  aquarium: { object: '水泡来信', color: '#2586b2', motion: 'float' },
  buddy: { object: '牛马小邮包', color: '#35669d', motion: 'swing' },
  beaver: { object: '林间树叶信', color: '#628444', motion: 'leaf' },
  hamster: { object: '仓鼠齿轮信', color: '#ae742b', motion: 'gear' },
  cultivation: { object: '传音纸鹤', color: '#558574', motion: 'crane' },
  battery: { object: '电池通信屏', color: '#26785a', motion: 'signal' },
  feidudu: { object: '奶茶小便笺', color: '#bb7934', motion: 'sip' },
  fox: { object: '墨尾小笺', color: '#626572', motion: 'ink' },
  luckycat: { object: '金铃来信', color: '#be5951', motion: 'bell' },
  dinosaur: { object: '恐龙小手机', color: '#2d8e76', motion: 'phone' },
  skadi: { object: '月牙信封', color: '#647fb6', motion: 'moon' },
}
export function messageGroups(items: MessageItem[]) {
  const groups = new Map<string, { id: string; title: string; items: MessageItem[]; fresh: number }>()
  for (const item of items) { const group = groups.get(item.conversation) ?? { id: item.conversation, title: item.title, items: [], fresh: 0 }; group.items.push(item); if (item.fresh) group.fresh++; groups.set(item.conversation, group) }
  return [...groups.values()]
}
// Widget remounts / scene switches share the announcement history. It has no quota account dependency.
let epoch = '', announced = new Set<string>()
export function claimArrival(state: MessageState | undefined, blocked: boolean): MessageItem | undefined {
  if (!state) return
  if (state.epoch !== epoch) { epoch = state.epoch; announced = new Set() }
  if (blocked || state.status !== 'ready') return
  const pending = state.items.filter(i => i.fresh && !announced.has(i.key))
  pending.forEach(i => announced.add(i.key))
  if (announced.size > 1000) announced = new Set(state.items.map(i => i.key))
  return pending[0]
}
