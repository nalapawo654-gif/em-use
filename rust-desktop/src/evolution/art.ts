import type { Scene } from '../shared/types'
export type GearScene = Exclude<Scene, 'modelmuse' | 'basketball' | 'aquarium' | 'hermit'>
export type GearPart = 0 | 1 | 2 | 3
export type Placement = [number, number, number, number, number?]
export const EVOLUTION_NAMES: Record<Scene, string> = {
  modelmuse: '灵感变装',
  basketball: '星场王牌',
  hermit: '小窝觉醒', potato: '星核觉醒', fox: '玄金灵兽', skadi: '月冕战装', piranha: '日冕花王', dinosaur: '晶脊古龙',
  luckycat: '福运神使', feidudu: '星航队长', aquarium: '星海灵鱼', buddy: '曙光守卫',
  beaver: '森工大师', hamster: '星籽精灵', cultivation: '太初法相', battery: '星能核心',
}
const layouts: Record<GearScene, Placement[]> = {
  potato: [[.5,.40,.92,.60],[.5,.12,.36,.23],[.5,.60,.68,.34],[.5,.89,.62,.20]],
  fox: [[.43,.52,.88,.85],[.79,.39,.10,.14],[.66,.65,.50,.34],[.65,.88,.26,.12]],
  skadi: [[.50,.64,.87,.62],[.48,.12,.32,.19],[.50,.55,.36,.25],[.50,.77,.57,.33]],
  piranha: [[.50,.40,.96,.79],[.50,.20,.27,.15],[.50,.62,.98,.36],[.50,.82,.64,.32]],
  dinosaur: [[.69,.55,.53,.73,65],[.52,.24,.44,.20],[.49,.70,.34,.36],[.73,.78,.20,.23]],
  luckycat: [[.50,.53,.95,.63],[.42,.19,.28,.17],[.50,.71,.51,.34],[.50,.80,.44,.14]],
  feidudu: [[.56,.57,.85,.60],[.48,.23,.38,.16],[.50,.63,.44,.36],[.51,.88,.50,.19]],
  buddy: [[.68,.66,.51,.42],[.33,.17,.34,.22],[.53,.68,.55,.38],[.57,.91,.62,.14]],
  beaver: [[.40,.55,.57,.60],[.67,.31,.30,.18],[.64,.70,.43,.37],[.26,.85,.37,.21,-10]],
  hamster: [[.52,.52,.75,.78],[.54,.30,.41,.17],[.53,.61,.44,.25],[.52,.75,.41,.15]],
  cultivation: [[.50,.47,.90,.86],[.50,.11,.32,.18],[.50,.64,.53,.32],[.50,.85,.90,.29]],
  battery: [[.50,.48,.57,.62],[.50,.18,.34,.19],[.50,.62,.52,.35],[.50,.78,.42,.20]],
}
export function gearPlacement(scene: GearScene, part: GearPart, pose = 0, form = 'chibi'): Placement {
  const p = [...layouts[scene][part]!] as Placement
  // Pose adapters retain costume while the real character becomes tired/rests.
  if (scene === 'skadi' && form === 'adult') { if (part === 1) { p[1] = .10; p[2] *= .78 } if (part === 2) { p[1] = .47; p[2] *= .85 } }
  if (scene === 'fox' && pose >= 2) { p[1] = part === 1 ? .66 : part === 0 ? .70 : .80; if (part === 0) p[3] *= .57; if (part === 2) p[3] *= .6 }
  if (scene === 'buddy' && pose >= 2) { p[1] += part === 1 ? .25 : part === 3 ? 0 : .12; if (part !== 1) p[3] *= .60 }
  if (scene === 'beaver' && pose >= 5) { p[1] = part === 1 ? .67 : .84; p[3] *= .5 }
  if (scene === 'hamster' && [3,5].includes(pose)) { p[1] = part === 1 ? .63 : part === 0 ? .72 : .82; p[3] *= .6 }
  if (['feidudu', 'dinosaur'].includes(scene) && [2,3,4,7].includes(pose)) { p[1] = part === 1 ? .56 : part === 0 ? .67 : .80; p[3] *= .55 }
  if (scene === 'skadi' && pose === 5) { p[1] = part === 1 ? .30 : part === 2 ? .70 : .80; if (part !== 1) p[3] *= .7 }
  if (scene === 'feidudu' && [2,3,4,7].includes(pose) && part === 1) { p[0] = .36; p[1] = .66 }
  if (scene === 'skadi' && pose === 4) { p[1] = part === 1 ? .52 : part === 0 ? .69 : .79; p[3] *= .55 }
  return p
}
