import type { CalendarEvent, CalendarState, Scene } from './types'
export const calendarTime = (time: number) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(time)
export const calendarDay = (time: number) => new Date(time + 8 * 3600_000).toISOString().slice(0, 10)
export function reminderHeading(event: CalendarEvent, now: number) {
  const remaining = event.start - now
  return remaining <= 0 ? '到开始时间了' : remaining < 60_000 ? '不到 1 分钟' : `还有 ${Math.ceil(remaining / 60_000)} 分钟`
}
export function nextCalendarEvent(state: CalendarState | undefined, now: number) {
  if (!state || state.date !== calendarDay(now)) return undefined
  return state.items.filter(e => !e.allDay && e.end > now).sort((a,b) => a.start-b.start)[0]
}
export function eventStatus(event: CalendarEvent, now: number) {
  return event.allDay ? '全天' : event.end <= now ? '已过计划时段' : event.start <= now ? '按计划进行中' : `今天 ${calendarTime(event.start)}`
}
export function overlaps(event: CalendarEvent, items: CalendarEvent[]) {
  return !event.allDay && items.some(e => e.key !== event.key && !e.allDay && e.start < event.end && e.end > event.start)
}

const PERSONAS:Record<Scene,[string,string]>={
 buddy:['先把手头这段收个尾。','到点啦，我帮你看着桌面。'],
 aquarium:['先收个尾，小鱼在水里等你回来。','到点啦，小鱼替你守着这片水景。'],
 beaver:['木头先放一放，给接下来的安排留点时间。','到点啦，这片小树林交给我。'],
 hamster:['跑轮慢一圈，下一项安排快到啦。','到点啦，机房由小仓鼠值班。'],
 cultivation:['先收势调息，稍后还有一场人间之约。','赴约的时辰到了，仙岛替你留着。'],
 battery:['这一组快收尾，给下一项安排热个身。','到点啦，带上刚充好的精神出发。'],
 feidudu:['奶茶先放好，等会儿有件事要做。','到点啦，我抱着奶茶等你回来。'],
 dinosaur:['摸鱼暂停一下，下一项安排快到啦。','到点啦，小恐龙替你守住工位。'],
 fox:['这一笔慢慢收好，给下一段留些白。','时辰到了，小狐替你留一盏月色。'],
 luckycat:['好运先替你攒着，记得留几分钟准备。','到点啦，带着一点好运去赴约。'],
 skadi:['把手头的事慢慢收好，我会陪着你。','约定的时间到了。这里，我替你守着。'],
}
export function calendarPersona(scene:string,started:boolean){return (PERSONAS[scene as Scene]??PERSONAS.buddy)[started?1:0]}
