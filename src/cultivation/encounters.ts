import type { Practice } from './training'
import type { CultivationLevel } from './play'

interface EncounterDefinition {
  id: string; label: string; practices: readonly Practice[]; weight: number; duration: number
  captions: readonly [string, string, string]
}
// Empty practice lists mean a visitor can arrive during any practice.
export const ENCOUNTERS = [
  { id:'tribulation', label:'渡劫', practices:[], weight:1, duration:10000, captions:['劫云将至 · 凝神结界','天雷淬体 · 守住本心','雷息云散 · 道心更定'] },
  { id:'enlightenment', label:'顿悟', practices:[], weight:2, duration:10000, captions:['灵光乍现 · 心有所感','一念顿悟 · 莲华自生','万法归心 · 继续修行'] },
  { id:'drowsy', label:'打坐犯困', practices:['breath','stargaze'], weight:7, duration:9000, captions:['眼皮渐沉 · 就眯一会儿','头点三下 · 差点睡着','忽然惊醒 · 刚刚是在入定'] },
  { id:'runaway-sword', label:'飞剑失控', practices:['sword'], weight:12, duration:10000, captions:['剑鸣忽急 · 小心头顶','左躲右闪 · 掐诀召回','飞剑归位 · 这回听话了'] },
  { id:'golden-pill', label:'丹成异象', practices:['alchemy'], weight:9, duration:10000, captions:['炉中异香 · 丹火正好','金丹出炉 · 掌心接住','收丹入袖 · 这一炉成了'] },
  { id:'furnace-pop', label:'炼丹炸炉', practices:['alchemy'], weight:4, duration:9000, captions:['丹炉咕噜 · 火候有点过','噗的一声 · 脸都熏黑了','拍拍衣袖 · 下回少添点火'] },
  { id:'spirit-visit', label:'灵兽来访', practices:[], weight:4, duration:11000, captions:['仙鹤踱来 · 嘴里衔着灵草','俯身相迎 · 摸摸小脑袋','灵草收好 · 多谢仙鹤道友'] },
  { id:'crane-letter', label:'仙友传书', practices:[], weight:4, duration:12000, captions:['云间纸鹤 · 故人来信','展信轻读 · 嘴角有了笑意','折鹤送归 · 山海自有相逢'] },
] as const satisfies readonly EncounterDefinition[]
export type EncounterKind = typeof ENCOUNTERS[number]['id']
export interface Encounter { kind: EncounterKind; elapsed: number }
export const ENCOUNTER_DURATION = 10000 // Duration of the original two major encounters.
export function encounterDefinition(kind: EncounterKind) { return ENCOUNTERS.find(event=>event.id===kind)! }
export function encounterDuration(event: Encounter) { return encounterDefinition(event.kind).duration }
export function encounterPhase(event: Encounter) {
  const progress=event.elapsed/encounterDuration(event)
  return progress<.22?'gather':progress<.74?'release':'settle'
}
export function encounterCaption(event: Encounter) {
  return encounterDefinition(event.kind).captions[({gather:0,release:1,settle:2} as const)[encounterPhase(event)]]
}
export function eligibleEncounters(practice: Practice) {
  return ENCOUNTERS.filter(event=>!(event.practices as readonly Practice[]).length || (event.practices as readonly Practice[]).includes(practice))
}
export function chooseEncounter(practice: Practice, previous: EncounterKind|null, random:()=>number): EncounterKind {
  const pool=eligibleEncounters(practice).filter(event=>event.id!==previous)
  const value=random(), fraction=Number.isFinite(value)?Math.max(0,Math.min(.999999,value)):0
  let choice=fraction*pool.reduce((sum,event)=>sum+event.weight,0)
  for(const event of pool){choice-=event.weight;if(choice<0)return event.id}
  return pool[pool.length-1]!.id
}
// Previewing a practice-specific event first selects its matching practice.
// Runtime selection is already filtered and never silently changes the practice.
export function practiceForEncounter(kind: EncounterKind, current: Practice): Practice {
  const practices=encounterDefinition(kind).practices as readonly Practice[]
  return !practices.length || practices.includes(current)?current:practices[0]!
}
export function encounterActorPose(event: Encounter, level: CultivationLevel): number {
  if(level==='empty')return 3
  if(level==='low')return 2
  if(level==='unknown')return 0
  const phase=encounterPhase(event)
  switch(event.kind){
    case 'drowsy': return phase==='settle'?0:4
    case 'runaway-sword': return phase==='release'?0:5
    case 'furnace-pop': return phase==='gather'?4:0
    case 'golden-pill': return phase==='release'?5:4
    case 'spirit-visit': return phase==='gather'?0:5
    case 'crane-letter': return phase==='release'?4:0
    default: return phase==='release'?5:4
  }
}
