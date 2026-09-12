import type { SkadiAction } from './play'
import type { SkadiWeapon } from '../shared/types'
export const SKADI_WEAPON_INDEX: Record<SkadiWeapon, number> = { sword: 0, scythe: 1, staff: 2, twins: 3, bow: 4, butterfly: 5 }
export type SkadiAmbient = 'idle' | 'walk' | 'wave' | 'turn'
export function skadiAmbientAt(ms: number): SkadiAmbient {
  const t = ms % 42000
  return t >= 9000 && t < 13500 ? 'turn' : t >= 21000 && t < 25000 ? 'wave' : t >= 33500 && t < 37500 ? 'walk' : 'idle'
}
export function skadiMotionFrame(action: SkadiAction): number {
  return ({ idle: 0, pet: 1, sing: 2, blade: 3, work: 5, sleep: 4, cat: 1, walk: 0, sit: 5, wave: 3, drink: 2, summon: 3, fish: 3, feed: 1, dance: 3, fly: 3, turn: 0 } as const)[action]
}
export function skadiBlinkAt(ms: number): boolean { const t=ms%6100; return t>5820&&t<6040 }
export function skadiEnvelope(t: number): number { return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI*t)**2 }
export function skadiWeaponPower(action: SkadiAction): 'rest' | 'cast' | 'attack' {
  return action === 'blade' ? 'attack' : action === 'summon' ? 'cast' : 'rest'
}
export function skadiFishingPhase(elapsed: number): 'waiting' | 'bite' | 'missed' {
  return elapsed < 2400 ? 'waiting' : elapsed < 7500 ? 'bite' : 'missed'
}
