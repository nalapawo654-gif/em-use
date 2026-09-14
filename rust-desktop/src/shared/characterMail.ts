import { computed, inject, onUnmounted, provide, ref, shallowRef, type InjectionKey } from 'vue'
import { loadImage } from '../aquarium/sprites'
import type { Scene } from './types'
export type MailPose = 'held' | 'lap' | 'cup' | 'ground' | 'propped'
export interface MailRect { x:number; y:number; width:number; height:number }
export type MailPainter = (ctx:CanvasRenderingContext2D, rect:MailRect, pose:MailPose, variant?:'tag')=>void
const cache = new Map<string,Promise<HTMLCanvasElement>>()
export function loadCharacterMail(scene:Scene, variant?:'tag') {
 const path=`./assets/${scene}/message-${variant ?? 'prop'}.png`
 if(!cache.has(path))cache.set(path,loadImage(path).then(source=>{
  const canvas=document.createElement('canvas');canvas.width=source.naturalWidth;canvas.height=source.naturalHeight
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,0,0)
  const frame=ctx.getImageData(0,0,canvas.width,canvas.height),d=frame.data
  let left=canvas.width,top=canvas.height,right=0,bottom=0
  for(let i=0;i<d.length;i+=4){
   const matte=Math.max(0,Math.min(1,(Math.min(d[i]!,d[i+2]!)-d[i+1]!-25)/85))
   d[i+3]=Math.round(d[i+3]!*(1-matte))
   if(matte>0&&matte<1){d[i]-=Math.round((d[i]!-d[i+1]!)*matte);d[i+2]-=Math.round((d[i+2]!-d[i+1]!)*matte)}
   if(d[i+3]!>24){const x=i/4%canvas.width,y=Math.floor(i/4/canvas.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  }
  ctx.putImageData(frame,0,0)
  // Runtime atlas extraction: anchors refer to opaque art, not authoring margins.
  const trimmed=document.createElement('canvas');trimmed.width=right-left+1;trimmed.height=bottom-top+1
  trimmed.getContext('2d')!.drawImage(canvas,left,top,trimmed.width,trimmed.height,0,0,trimmed.width,trimmed.height)
  return trimmed
 }).catch(error=>{cache.delete(path);throw error}))
 return cache.get(path)!
}
function makeMail(scene:Scene){
 const enabled=ref(false),art=shallowRef<HTMLCanvasElement>(),tag=shallowRef<HTMLCanvasElement>(),pose=ref<MailPose>('held')
 const position=ref<Record<string,string>>(),painted=ref(false),failed=ref(false)
 let disposed=false,element:HTMLCanvasElement|undefined,bounds:MailRect|undefined,raf=0
 const active=computed(()=>enabled.value&&!!art.value&&(scene!=='feidudu'||!!tag.value))
 void Promise.all([loadCharacterMail(scene),scene==='feidudu'?loadCharacterMail(scene,'tag'):Promise.resolve(undefined)]).then(([a,t])=>{if(!disposed){art.value=a;tag.value=t}}).catch(()=>{failed.value=true})
 function track(){
  if(disposed)return
  if(element&&bounds&&enabled.value){
   const widget=element.closest(`[class~="${scene}-widget"]`)!,base=widget?.getBoundingClientRect(),box=element.getBoundingClientRect()
   if(base?.width&&box.width){
    const scale=Math.min(box.width/element.width,box.height/element.height),ox=box.x+(box.width-element.width*scale)/2-base.x,oy=box.y+(box.height-element.height*scale)/2-base.y
    const width=Math.max(24,bounds.width*scale),height=Math.max(24,bounds.height*scale)
    const next={left:`${ox+(bounds.x+bounds.width/2)*scale-width/2}px`,top:`${oy+(bounds.y+bounds.height/2)*scale-height/2}px`,width:`${width}px`,height:`${height}px`}
    if(!position.value||Object.entries(next).some(([key,value])=>position.value![key]!==value))position.value=next
   }
  }
  raf=requestAnimationFrame(track)
 }
 raf=requestAnimationFrame(track)
 const paint:MailPainter=(ctx,rect,p,variant)=>{
  if(!active.value)return
  const image=variant==='tag'?tag.value:art.value;if(!image)return
  ctx.save();ctx.shadowColor='#422b192e';ctx.shadowBlur=p==='ground'?5:2;ctx.shadowOffsetY=p==='ground'?3:1
  ctx.drawImage(image,rect.x,rect.y,rect.width,rect.height);ctx.restore()
  const matrix=ctx.getTransform(),points=[[rect.x,rect.y],[rect.x+rect.width,rect.y],[rect.x,rect.y+rect.height],[rect.x+rect.width,rect.y+rect.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix))
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y)
  bounds={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}
  element=ctx.canvas;pose.value=p;painted.value=true
  element.dataset.mailPose=p
 }
 onUnmounted(()=>{disposed=true;cancelAnimationFrame(raf)})
 return {enabled,active,paint,position,painted,pose,failed}
}
type CharacterMail=ReturnType<typeof makeMail>
const key:InjectionKey<CharacterMail>=Symbol('character-mail')
export function provideCharacterMail(scene:Scene){const mail=makeMail(scene);provide(key,mail);return mail}
export function useCharacterMail(){return inject(key,undefined)}
// Restore only the original foreground fingertips after inserting a held object.
// This never adds a limb: the pixels come from the same currently rendered pose.
export function foregroundPaw(ctx:CanvasRenderingContext2D,source:HTMLCanvasElement,x:number,y:number,rx:number,ry:number){
 ctx.save();ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.clip();ctx.drawImage(source,0,0);ctx.restore()
}
