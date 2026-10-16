import { gearPlacement, type GearPart, type GearScene } from './art'
export interface EvolutionEquipment { parts: HTMLImageElement[]; glow: number }
export function equipmentPart(ctx: CanvasRenderingContext2D, equipment: EvolutionEquipment | undefined, part: GearPart, x: number, y: number, width: number, height: number, angle = 0) {
  const image = equipment?.parts[part]; if (!image) return
  const scale = Math.min(width/image.width, height/image.height)
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.shadowColor='#dfb65c50'; ctx.shadowBlur=2*equipment!.glow
  ctx.drawImage(image,-image.width*scale/2,-image.height*scale/2,image.width*scale,image.height*scale);ctx.restore()
}
export function paintEquipment(ctx: CanvasRenderingContext2D, equipment: EvolutionEquipment | undefined, scene: GearScene, parts: GearPart[], pose = 0) {
  for (const part of parts) { const [x,y,w,h,angle=0]=gearPlacement(scene,part,pose); equipmentPart(ctx,equipment,part,x*512,y*512,w*512,h*512,angle*Math.PI/180) }
}
