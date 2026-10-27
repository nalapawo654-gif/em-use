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
const sheets: Record<GearScene, [string, number]> = {
  potato: ['tech', 0], feidudu: ['tech', 1], battery: ['tech', 2],
  fox: ['spirit', 0], skadi: ['spirit', 1], cultivation: ['spirit', 2],
  piranha: ['garden', 0], luckycat: ['garden', 1], hamster: ['garden', 2],
  buddy: ['woodland', 0], dinosaur: ['woodland', 1], beaver: ['woodland', 2],
}
// Per-character crop rectangles in the 1448 x 1088 reference coordinate system.
// Insets intentionally exclude neighboring items in non-uniform generated sheets.
const crops: Record<GearScene, [number,number,number,number][]> = {
  potato: [[0,60,380,320],[390,50,300,320],[690,70,410,300],[1090,145,358,230]],
  feidudu: [[0,405,380,300],[390,415,325,280],[725,420,360,290],[1085,475,363,235]],
  battery: [[0,735,390,290],[395,730,320,295],[725,735,360,290],[1090,755,358,265]],
  fox: [[0,0,450,388],[465,85,175,220],[690,60,440,325],[1135,120,313,180]],
  skadi: [[0,389,453,320],[455,390,258,315],[715,395,385,310],[1095,390,353,320]],
  cultivation: [[0,710,460,378],[420,730,285,345],[705,735,390,340],[1095,745,353,290]],
  piranha: [[0,0,390,380],[395,110,280,230],[680,100,443,260],[1125,115,323,255]],
  luckycat: [[0,395,420,310],[460,425,215,225],[685,415,427,290],[1120,470,328,235]],
  hamster: [[0,710,390,378],[390,770,340,245],[735,780,367,250],[1105,795,343,230]],
  buddy: [[0,50,415,320],[425,45,310,270],[735,60,360,300],[1100,70,348,280]],
  dinosaur: [[20,385,390,315],[430,405,335,240],[795,385,270,315],[1155,400,280,300]],
  beaver: [[0,705,420,335],[425,780,305,205],[740,730,350,290],[1135,720,313,300]],
}
const pending = new Map<string, Promise<HTMLImageElement>>()
const parts = new Map<GearScene, Promise<string[]>>()
export function loadEvolutionImage(path: string) {
  let promise = pending.get(path)
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => { pending.delete(path); reject(new Error('觉醒素材未能加载')) }; img.src = path })
    pending.set(path, promise)
  }
  return promise
}
export function loadEvolutionParts(scene: GearScene): Promise<string[]> {
  let result = parts.get(scene)
  if (!result) {
    const [sheet] = sheets[scene]
    result = loadEvolutionImage(`./assets/evolution/${sheet}.png`).then(img => {
      const bounds = crops[scene]
      return Array.from({ length: 4 }, (_, column) => {
        const [x,y,width,height] = bounds[column]!
        const sx = Math.round(x / 1448 * img.width), sy = Math.round(y / 1088 * img.height)
        const w = Math.round(width / 1448 * img.width), h = Math.round(height / 1088 * img.height)
        const cell = document.createElement('canvas'); cell.width = w; cell.height = h
        const ctx = cell.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h)
        const pixels = ctx.getImageData(0, 0, w, h).data
        let left = w, top = h, right = 0, bottom = 0
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pixels[(y * w + x) * 4 + 3]! > 40) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
        if (left > right) throw new Error('觉醒素材为空')
        const cropped = document.createElement('canvas'); cropped.width = right - left + 1; cropped.height = bottom - top + 1
        cropped.getContext('2d')!.drawImage(cell, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
        return cropped.toDataURL()
      })
    }).catch(error => { parts.delete(scene); throw error })
    parts.set(scene, result)
  }
  return result
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

const rigs = new Map<GearScene, Promise<HTMLImageElement[]>>()
export function loadEvolutionRig(scene: GearScene) {
  let rig = rigs.get(scene)
  if (!rig) {
    rig = loadEvolutionParts(scene).then(parts => Promise.all(parts.map(loadEvolutionImage))).catch(error => { rigs.delete(scene); throw error })
    rigs.set(scene, rig)
  }
  return rig
}
