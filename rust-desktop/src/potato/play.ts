import { petQuotaIndex } from '../shared/petQuota'
import { POTATO_SKINS, type PotatoSkin } from './catalog'
export type PotatoLevel = 'full' | 'worn' | 'taped' | 'cardboard' | 'unknown'
export type PotatoAction = 'idle' | 'pet' | 'coffee' | 'calculate' | 'shield' | 'cheer' | 'tease' | 'repair'
export const POTATO_ACTIONS = [
  { id:'pet', label:'摸摸头盔', hint:'轻碰头盔，战神也会害羞', duration:1800, prop:8 },
  { id:'coffee', label:'喂口咖啡', hint:'咕嘟一口，陪你小歇', duration:3400, prop:3 },
  { id:'calculate', label:'打开驾驶舱', hint:'点三次算盘，算一笔虚构小账', duration:null, prop:7 },
  { id:'shield', label:'装备锅盖', hint:'锅盖也是盾牌，点击卸下恢复', duration:null, prop:4 },
  { id:'cheer', label:'插上加油旗', hint:'小旗一挥，给你打气', duration:3600, prop:5 },
  { id:'tease', label:'逗逗战神', hint:'一小步一小步，假装威风', duration:2600, prop:9 },
  { id:'repair', label:'拧紧螺丝', hint:'点三次扳手，检查机甲连接', duration:null, prop:6 },
] as const
export const POTATO_MOODS: Record<PotatoLevel,{title:string;speech:string}> = {
 full:{title:'豪华机甲',speech:'全装出击！今天也要稳稳当当。'},
 worn:{title:'部分损耗',speech:'有点磨损，气势还是满格！'},
 taped:{title:'胶带机甲',speech:'胶带贴一贴，认真继续。'},
 cardboard:{title:'纸箱机甲',speech:'装备可以没，土豆的气势不能输！'},
 unknown:{title:'机库待命',speech:'先陪你待命，额度还没同步。'},
}
export interface PotatoPlay { action:PotatoAction; started:number; steps:number; lastTap:number; completedAt:number|null }
export const potatoIdle = ():PotatoPlay => ({action:'idle',started:0,steps:0,lastTap:-Infinity,completedAt:null})
export function potatoLevel(percent:number|null):PotatoLevel {
 const index=petQuotaIndex(percent,4)
 return index===null?'unknown':(['full','worn','taped','cardboard'] as const)[index]!
}
export function potatoFrame(percent:number|null,skin:PotatoSkin) {
 const item=POTATO_SKINS.find(item=>item.id===skin) ?? POTATO_SKINS[0]
 return {atlas:item.atlas,frame:item.row*4+(petQuotaIndex(percent,4)??0)}
}
export function beginPotato(action:PotatoAction,now:number):PotatoPlay {return action==='idle'?potatoIdle():{...potatoIdle(),action,started:now}}
export function tapPotato(play:PotatoPlay,now:number):PotatoPlay {
 if(!['calculate','repair'].includes(play.action)||play.completedAt!==null||!Number.isFinite(now)||now<play.started||now-play.lastTap<240)return play
 const steps=play.steps+1
 return {...play,steps,lastTap:now,completedAt:steps===3?now:null}
}
export function advancePotato(play:PotatoPlay,now:number):PotatoPlay {
 if(play.completedAt!==null)return now-play.completedAt>=1100?potatoIdle():play
 const duration=POTATO_ACTIONS.find(a=>a.id===play.action)?.duration
 return duration!=null&&now-play.started>=duration?potatoIdle():play
}
