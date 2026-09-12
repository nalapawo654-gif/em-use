import type { SkadiForm, SkadiSkin, SkadiWeapon } from '../shared/types'
import { skadiSpritePoint } from './sprites'
export type Point = [number,number]
// Palm centers in the authored 512px cells; converted through the same crop/scale
// as the displayed artwork. Values are per pose, never viewport percentages.
const adult: [Point,Point][]=[[[186,265],[335,265]],[[183,265],[326,265]],[[251,140],[357,259]],[[154,263],[379,131]],[[263,325],[305,335]],[[252,204],[288,124]]]
const chibi: [Point,Point][]=[[[226,347],[369,347]],[[194,347],[338,347]],[[256,256],[323,347]],[[192,226],[376,289]],[[215,301],[253,256]],[[252,294],[290,227]]]
export function skadiHands(form:SkadiForm,skin:SkadiSkin,frame:number):[Point,Point]{
 const points=(form==='adult'?adult:chibi)[frame]??(form==='adult'?adult:chibi)[0]
 return points.map(p=>skadiSpritePoint(form,skin,frame,p)) as [Point,Point]
}
export const WEAPON_GRIPS:Record<SkadiWeapon,Point>={sword:[372,81],scythe:[227,324],staff:[199,321],twins:[165,129],bow:[185,238],butterfly:[264,315]}
export function skadiHeldScale(form:SkadiForm,weapon:SkadiWeapon,frame:number):number{
 const size={sword:.47,scythe:.68,staff:.67,twins:.42,bow:.64,butterfly:.37}[weapon]
 return size*(form==='chibi'?.87:1)*(frame===4?.7:1)
}
