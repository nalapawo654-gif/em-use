import type { HamsterSkin } from '../shared/types'
import { loadImage } from '../aquarium/sprites'
let cached: Promise<HTMLCanvasElement[]> | undefined
// The source atlas uses a dedicated magenta matte. Remove that matte at load
// time, just as the existing pet renderers isolate their studio backgrounds.
// White fur, dark eyes, red fabric and the blue blanket are outside this key.
export function hamsterMatte(r: number, g: number, b: number) {
  return r > g + 35 && b > g + 35 && b > r * .62 ? Math.max(0, Math.min(1, (Math.min(r, b) - g - 25) / 100)) : 0
}
export function texture(image: HTMLImageElement, region: number[], width: number, height: number) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, region[0], region[1], region[2], region[3], 0, 0, width, height)
  const frame = context.getImageData(0, 0, width, height), px = frame.data
  for (let i = 0; i < px.length; i += 4) {
    const matte = hamsterMatte(px[i], px[i + 1], px[i + 2])
    if (matte) { px[i + 3] = Math.round(px[i + 3] * (1 - matte)); px[i + 2] = Math.min(px[i + 2], Math.max(px[i + 1], px[i] * .65)) }
  }
  context.putImageData(frame, 0, 0)
  return canvas
}
export function hamsterFrames() {
  if (!cached) cached = Promise.all([loadImage('./assets/hamster/atlas-chroma.png'), loadImage('./assets/hamster/wheel-parts.png')]).then(([image, wheel]) => [
    ...Array.from({ length: 6 }, (_, index) => texture(image, [index % 3 * 512, Math.floor(index / 3) * 512, 512, 512], 512, 512)),
    texture(wheel, [255,60,745,735], 512, 512),
    texture(wheel, [270,912,716,244], 512, 174),
  ]).catch(error => { cached = undefined; throw error })
  return cached
}

function trim(canvas: HTMLCanvasElement) {
  const c = canvas.getContext('2d')!, { width:w, height:h } = canvas, p = c.getImageData(0,0,w,h).data
  let left=w, top=h, right=0, bottom=0
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(p[(y*w+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  const out=document.createElement('canvas');out.width=Math.max(1,right-left+1);out.height=Math.max(1,bottom-top+1)
  out.getContext('2d')!.drawImage(canvas,left,top,out.width,out.height,0,0,out.width,out.height);return out
}
export interface HamsterRig { base:HTMLCanvasElement[]; skins:Partial<Record<HamsterSkin, HTMLCanvasElement[]>> }
let rig:Promise<HamsterRig>|undefined, props:Promise<HTMLCanvasElement[]>|undefined
const skins = new Map<HamsterSkin, Promise<HTMLCanvasElement[]>>()
export function hamsterRig():Promise<HamsterRig>{ return rig ||= hamsterFrames().then(base=>({base,skins:{}})).catch(error=>{rig=undefined;throw error}) }
// Atlas neighbors can leave isolated edge slivers after a fractional cell crop.
// Remove only tiny disconnected components, preserving the character silhouette.
function clearAtlasSpecks(canvas:HTMLCanvasElement){
  const ctx=canvas.getContext('2d')!,w=canvas.width,h=canvas.height,img=ctx.getImageData(0,0,w,h),seen=new Uint8Array(w*h)
  for(let start=0;start<w*h;start++){
    if(seen[start]||img.data[start*4+3]<24)continue
    const component=[start];seen[start]=1
    for(let at=0;at<component.length;at++){
      const index=component[at],x=index%w,y=Math.floor(index/w)
      for(const next of [x>0?index-1:-1,x<w-1?index+1:-1,y>0?index-w:-1,y<h-1?index+w:-1])if(next>=0&&!seen[next]&&img.data[next*4+3]>=24){seen[next]=1;component.push(next)}
    }
    if(component.length<1200)for(const index of component)img.data[index*4+3]=0
  }
  ctx.putImageData(img,0,0)
}
let feeding:Promise<HTMLCanvasElement[]>|undefined
function feedFrames(){return feeding ||= loadImage('./assets/hamster/dressed/feeding.png').then(image=>Array.from({length:14},(_,i)=>{
  const w=image.naturalWidth/7,h=image.naturalHeight/2
  const frame=texture(image,[i%7*w,Math.floor(i/7)*h,w,h],256,512);clearAtlasSpecks(frame);const data=frame.getContext('2d')!.getImageData(0,0,256,512).data
  let bottom=0;for(let y=0;y<512;y++)for(let x=0;x<256;x++)if(data[(y*256+x)*4+3]>64)bottom=Math.max(bottom,y)
  const aligned=document.createElement('canvas');aligned.width=256;aligned.height=512;aligned.getContext('2d')!.drawImage(frame,0,480-bottom);return aligned
})).catch(error=>{feeding=undefined;throw error})}
// Every frame contains the entire dressed animal. No independent hat or trouser layer.
export async function loadHamsterSkin(skin:HamsterSkin){
  if(!skins.has(skin)) skins.set(skin,Promise.all([
    loadImage(`./assets/hamster/dressed/${skin}.png`),
    loadImage(`./assets/hamster/dressed/corrected/${skin}.png`),
  ]).then(([image,corrected])=>{
    return Array.from({length:12},(_,i)=>{
      // Columns 2 and 4 in both original rows contain a third hind paw.
      // Replace those whole-character frames only; retain the other poses and
      // the six-step cadence. No extra limb layer or blended frame is drawn.
      const source=i%6===1||i%6===3?corrected:image
      const sw=source.naturalWidth/6,sh=source.naturalHeight/2
      const frame=texture(source,[i%6*sw,Math.floor(i/6)*sh,sw,sh],256,512)
      const data=frame.getContext('2d')!.getImageData(0,0,256,512).data
      let bottom=0
      for(let y=0;y<512;y++)for(let x=0;x<256;x++)if(data[(y*256+x)*4+3]>64)bottom=Math.max(bottom,y)
      // Register the contact paw to the same wheel surface, preserving every frame's scale.
      const aligned=document.createElement('canvas');aligned.width=256;aligned.height=512
      aligned.getContext('2d')!.drawImage(frame,0,480-bottom);return aligned
    })
  }).catch(error=>{skins.delete(skin);throw error}))
  const [r,frames,food]=await Promise.all([hamsterRig(),skins.get(skin)!,feedFrames()]);const column=['classic','worker','nightshift','rain','summer','winter','holiday'].indexOf(skin);r.skins[skin]=[...frames,food[column],food[column+7]];return r
}
let cat:Promise<HTMLCanvasElement[]>|undefined
export function catFrames(){return cat ||= loadImage('./assets/hamster/cat-actions.png').then(image=>Array.from({length:12},(_,i)=>{
  const w=image.naturalWidth/4,row=Math.floor(i/4),bands=[0,355,682,1024].map(y=>Math.round(y*image.naturalHeight/1024)),h=bands[row+1]-bands[row]
  const raw=texture(image,[i%4*w,bands[row],w,h],384,h)
  const data=raw.getContext('2d')!.getImageData(0,0,384,h).data
  let bottom=0;for(let y=0;y<h;y++)for(let x=0;x<384;x++)if(data[(y*384+x)*4+3]>64)bottom=Math.max(bottom,y)
  const aligned=document.createElement('canvas');aligned.width=384;aligned.height=341;aligned.getContext('2d')!.drawImage(raw,0,338-bottom);return aligned
})).catch(error=>{cat=undefined;throw error})}
export function hamsterProps(){
  return props ||= loadImage('./assets/hamster/props.png').then(image=>Array.from({length:12},(_,i)=>{
    const bands=[0,370,680,1024], row=Math.floor(i/4)
    return trim(texture(image,[i%4*384,bands[row],384,bands[row+1]-bands[row]],384,bands[row+1]-bands[row]))
  })).catch(error=>{props=undefined;throw error})
}
