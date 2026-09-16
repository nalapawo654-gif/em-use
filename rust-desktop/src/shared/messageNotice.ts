import type { MessageItem, MessageState, Scene } from './types'
export function messageWindowError(error: unknown): string {
  const detail = typeof error === 'string' ? error
    : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : ''
  return `消息窗口未能打开${detail ? `：${detail}` : '。'}`
}

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
  for (const item of [...items].sort((a, b) => b.at - a.at)) { const group = groups.get(item.conversation) ?? { id: item.conversation, title: item.title, items: [], fresh: 0 }; group.items.push(item); if (item.fresh) group.fresh++; groups.set(item.conversation, group) }
  return [...groups.values()]
}
// Widget remounts / scene switches share both message and conversation arrival history.
// An open toast updates in place. After it closes, a continuing burst stays quiet.
export const MESSAGE_BURST_GAP = 30_000
let epoch = '', announced = new Set<string>(), lastArrival = new Map<string, number>()
export function claimArrival(state: MessageState | undefined, blocked: boolean, activeConversation?: string, now = Date.now()): MessageItem | undefined {
  if (!state) return
  if (state.epoch !== epoch) { epoch = state.epoch; announced = new Set(); lastArrival = new Map() }
  const unread = new Set(state.items.filter(i => i.fresh).map(i => i.conversation))
  for (const conversation of lastArrival.keys()) if (!unread.has(conversation)) lastArrival.delete(conversation)
  if (blocked || state.status !== 'ready') return
  const pending = state.items.filter(i => i.fresh && !announced.has(i.key)).sort((a, b) => b.at - a.at)
  const arrival = pending.find(i => i.conversation === activeConversation || !lastArrival.has(i.conversation) || now - lastArrival.get(i.conversation)! >= MESSAGE_BURST_GAP)
  pending.forEach(i => { announced.add(i.key); lastArrival.set(i.conversation, now) })
  if (announced.size > 1000) announced = new Set(state.items.map(i => i.key))
  return arrival
}

// Keep a toast attached to its conversation even when its original message is evicted.
export function toastGroup(state: MessageState | undefined, toast: { epoch: string; key: string; conversation?: string } | null | undefined) {
  if (!state || state.status !== 'ready' || state.epoch !== toast?.epoch) return
  const conversation = toast.conversation ?? state.items.find(i => i.key === toast.key)?.conversation
  return messageGroups(state.items).find(g => g.id === conversation)
}
