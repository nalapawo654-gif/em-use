import { LruCache } from '../shared/lruCache'
import { skadiFrame } from '../skadi/play'
import { energyFrame } from './atlas'
import { clearEdgeSpecks } from './atlas'
import type { Scene } from '../shared/types'
import { awakeningStyle } from './wardrobe'
import manifest from './transformation-manifest.json'

export interface TransformationAtlas { file:string; name:string; size:number[]; rects:number[][]; clips?:Record<string,number[][]> }
export const TRANSFORMATION_ATLASES:Record<string,TransformationAtlas>=manifest
export const transformationKey=(scene:Scene,skin:string,form='chibi')=>`${scene}/${skin}${scene==='skadi'?'/'+form:''}`
export function transformationEndFrame(scene:Scene,percent:number|null,count:number){return scene==='skadi'?skadiFrame('idle',percent):energyFrame(percent,scene==='cultivation'||scene==='hermit'?4:count)}
const clamp=(v:number)=>Math.max(0,Math.min(1,v))
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t)}
export function transformationTime(elapsed:number,duration:number,reverse=false){
  const progress=clamp(elapsed/Math.max(1,duration)),t=reverse?1-progress:progress
  return {t,progress,beat:t<.1875?'gather':t<.5?'grow':t<.8125?'reveal':'settle',done:progress>=1}
}
const sheets=new LruCache<string,Promise<HTMLImageElement>>(2),cache=new LruCache<string,Promise<HTMLCanvasElement[]>>(4)
export function loadTransformation(scene:Scene,skin:string,form='chibi'){
  const key=transformationKey(scene,skin,form),spec=TRANSFORMATION_ATLASES[key]
  if(!spec)return Promise.reject(new Error(`Missing transformation: ${key}`))
  const old=cache.get(key);if(old)return old
  let sheet=sheets.get(spec.file)
  if(!sheet){sheet=new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('变身分镜未加载'));image.src=`./assets/evolution/v3/${spec.file}`});sheets.set(spec.file,sheet);void sheet.catch(()=>{if(sheets.get(spec.file)===sheet)sheets.delete(spec.file)})}
  const pending=sheet.then(image=>{
    const scale=Math.min(430/Math.max(...spec.rects.map(r=>r[2]!)),442/Math.max(...spec.rects.map(r=>r[3]!)))
    return spec.rects.map(([x,y,w,h],index)=>{
      const crop=document.createElement('canvas');crop.width=w!;crop.height=h!;const ctx=crop.getContext('2d')!
      // A per-pose outline separates the rare silhouettes that interleave across rows.
      const clip=spec.clips?.[String(index)]
      if(clip){ctx.beginPath();clip.forEach(([px,py],i)=>{if(i===0)ctx.moveTo(px!-x!,py!-y!);else ctx.lineTo(px!-x!,py!-y!)});ctx.closePath();ctx.clip()}
      ctx.drawImage(image,x!,y!,w!,h!,0,0,w!,h!);clearEdgeSpecks(crop,.15)
      const c=document.createElement('canvas');c.width=c.height=512;c.getContext('2d')!.drawImage(crop,(512-w!*scale)/2,480-h!*scale,w!*scale,h!*scale);return c
    })
  })
  cache.set(key,pending);void pending.catch(()=>{if(cache.get(key)===pending)cache.delete(key)});return pending
}
const keys=[0,.1875,.34,.5,.67,.8125,1]
export function createTransformationRenderer(scene:Scene,skin:string,poses:HTMLCanvasElement[]){
  const layer=document.createElement('canvas');layer.width=layer.height=512;const body=layer.getContext('2d')!
  const palette=awakeningStyle(scene,skin),edge=palette?.edge??'#efc768',light=palette?.light??'#fff0bd'
  return(ctx:CanvasRenderingContext2D,elapsed:number,duration:number,target:HTMLCanvasElement,reverse=false)=>{
    const time=transformationTime(elapsed,duration,reverse),t=time.t,images=scene==='skadi'?[...poses.slice(0,5),target,target]:[...poses,target]
    ctx.clearRect(0,0,512,512)
    if(t<=0){ctx.drawImage(poses[0]!,0,0);return time}if(t>=1){ctx.drawImage(target,0,0);return time}
    let index=0;while(index<keys.length-2&&t>keys[index+1]!)index++
    const blend=smooth(((t-keys[index]!)/(keys[index+1]!-keys[index]!)-.25)/.75)
    body.clearRect(0,0,512,512);body.globalCompositeOperation='source-over';body.globalAlpha=1-blend;body.drawImage(images[index]!,0,0)
    body.globalCompositeOperation='lighter';body.globalAlpha=blend;body.drawImage(images[index+1]!,0,0);body.globalAlpha=1;body.globalCompositeOperation='source-over'
    const gathering=Math.sin(Math.PI*clamp(t/.5)),reveal=Math.sin(Math.PI*clamp((t-.5)/.32)),energy=smooth(t/.14)*(1-smooth((t-.72)/.25))
    const aquatic=scene==='aquarium',floating=scene==='cultivation'||scene==='skadi',mechanical=scene==='potato'||scene==='battery'
    // Authored body poses do the transformation; effects reinforce each role.
    ctx.save();ctx.translate(256,480-(floating?14:6)*reveal+(aquatic?0:3*gathering));ctx.rotate(aquatic?-.07*gathering:0)
    ctx.scale(1+(mechanical?.008:.016)*gathering,1-.018*gathering);ctx.drawImage(layer,-256,-480);ctx.restore()
    ctx.save();ctx.strokeStyle=light;ctx.fillStyle=edge;ctx.lineWidth=2;ctx.globalAlpha=energy*.75
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+t*3,r=140-65*smooth(t/.5)+90*smooth((t-.5)/.3),x=256+Math.cos(a)*r,y=310+Math.sin(a)*r*.85
      ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath()
      if(aquatic){ctx.arc(0,0,4+i%3,0,Math.PI*2);ctx.stroke()}
      else if(mechanical){ctx.rect(-4,-5,8,10);ctx.fill();ctx.stroke()}
      else if(['fox','piranha','beaver'].includes(scene)){ctx.ellipse(0,0,3,7,.4,0,Math.PI*2);ctx.fill()}
      else if(floating){ctx.arc(0,0,7,0,Math.PI*1.55);ctx.stroke()}
      else {ctx.moveTo(0,-7);ctx.lineTo(2,0);ctx.lineTo(7,2);ctx.lineTo(0,4);ctx.lineTo(-3,8);ctx.lineTo(-4,1);ctx.closePath();ctx.fill()}
      ctx.restore()
    }
    if(mechanical){const y=450-310*smooth((t-.15)/.45);ctx.beginPath();ctx.moveTo(160,y);ctx.lineTo(352,y);ctx.stroke()}
    else if(floating){ctx.beginPath();ctx.ellipse(256,470,105+35*t,13,0,0,Math.PI*2);ctx.stroke()}
    ctx.restore();return time
  }
}
