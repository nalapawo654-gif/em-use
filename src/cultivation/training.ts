import type { CultivationRealm } from '../shared/types'
import type { CultivationLevel } from './play'
import { chooseEncounter, encounterDuration, type Encounter, type EncounterKind } from './encounters'
export * from './encounters'
export const PRACTICES = [
  { id: 'breath', label: '吐纳聚气', hint: '抬掌引气，收势归元', prop: 10, realm: 'sunny' },
  { id: 'sword', label: '御剑温养', hint: '指随剑转，一剑绕青山', prop: 0, realm: 'thunder' },
  { id: 'alchemy', label: '丹炉炼丹', hint: '掌心控火，丹香渐起', prop: 1, realm: 'rain' },
  { id: 'stargaze', label: '星盘悟道', hint: '捻诀观星，天地入心', prop: 3, realm: 'night' },
] as const
export type Practice = typeof PRACTICES[number]['id']
// Legacy realm values remain readable in settings; encounters are temporary now.
export const REALMS: CultivationRealm[] = ['sunny','rain','night','thunder']
export interface Training {
  realm: CultivationRealm; practice: Practice; elapsed: number; remaining: number; sequence: number
  encounter: Encounter | null; encounterSequence: number; encounterRemaining: number; lastEncounter: EncounterKind | null
}
function sample(random: () => number) { const n=random(); return Number.isFinite(n) ? Math.max(0,Math.min(.999999,n)) : 0 }
export function chooseDifferent<T>(options: readonly T[], previous: T, random: () => number): T {
  const candidates=options.filter(v=>v!==previous)
  return candidates[Math.floor(sample(random)*candidates.length)] ?? previous
}
export function trainingInterval(random: () => number) { return 24_000 + Math.floor(sample(random)*18_000) }
export function createTraining(realm: CultivationRealm, random: () => number = Math.random): Training {
  return {realm:realm==='tribulation'?'thunder':realm==='enlightened'?'sunny':realm,practice:'breath',elapsed:0,remaining:trainingInterval(random),sequence:0,encounter:null,encounterSequence:0,encounterRemaining:10_000+sample(random)*8000,lastEncounter:null}
}
export function shuffleTraining(current: Training, changeRealm=true, random: () => number = Math.random): Training {
  return {...current,realm:changeRealm?chooseDifferent(REALMS,current.realm,random):current.realm,practice:chooseDifferent(PRACTICES.map(p=>p.id),current.practice,random),elapsed:0,remaining:trainingInterval(random),sequence:current.sequence+1,encounter:null}
}
export function startEncounter(current: Training, kind: EncounterKind): Training { return {...current,encounter:{kind,elapsed:0},encounterSequence:current.encounterSequence+1,lastEncounter:kind} }
export function advanceTraining(current: Training, delta: number, options: { paused: boolean; random: boolean; reduced: boolean }, random: () => number = Math.random): Training {
  if(options.paused || !Number.isFinite(delta) || delta<=0)return current
  const dt=Math.min(delta,250)
  // A reduced-motion event already on screen still finishes; no new events start.
  if(current.encounter){
    const elapsed=current.encounter.elapsed+dt
    return elapsed>=encounterDuration(current.encounter)
      ? {...current,encounter:null,remaining:Math.max(current.remaining,8000),encounterRemaining:26_000+sample(random)*20_000}
      : {...current,encounter:{...current.encounter,elapsed}}
  }
  if(options.reduced)return current
  const next={...current,elapsed:current.elapsed+dt,remaining:options.random?current.remaining-dt:current.remaining,encounterRemaining:options.random?current.encounterRemaining-dt:current.encounterRemaining}
  if(options.random && next.encounterRemaining<=0 && next.elapsed>=4000){
    return startEncounter(next,chooseEncounter(next.practice,next.lastEncounter,random))
  }
  return options.random && next.remaining<=0 ? shuffleTraining(next,true,random) : next
}
export function trainingPose(level: CultivationLevel, practice: Practice, elapsed: number, reduced: boolean): number {
  if(level==='empty')return 3
  if(level==='low')return 2
  if(level==='unknown')return 0
  if(reduced)return 4
  const p=((elapsed%6000)+6000)%6000
  if(p<900 || p>=5200)return level==='settling'?1:0
  if(practice==='stargaze')return p<3000?4:5
  return p<2300 || p>=4300?4:5
}
export function islandForRealm(realm: CultivationRealm): number { return ({sunny:0,rain:1,night:2,thunder:3,tribulation:3,enlightened:0})[realm] }
