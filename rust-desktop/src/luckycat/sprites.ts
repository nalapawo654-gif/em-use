export const LUCKYCAT_ASSET = './assets/luckycat/atlas.png'
// Green does not occur in this cat's fur or props. Decode once, preserve soft fur edges.
export function luckycatAlpha(r: number, g: number, b: number): number {
  return 1 - Math.max(0, Math.min(1, (g - Math.max(r, b) - 18) / 110))
}
let pending: Promise<string[]> | undefined
export function loadLuckyCat(): Promise<string[]> {
  return pending ??= new Promise((resolve, reject) => {
    const image = new Image()
    image.onerror = () => { pending = undefined; reject(new Error('招财猫素材加载失败')) }
    image.onload = () => {
      try {
        const frames = Array.from({ length: 8 }, (_, index) => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!
          ctx.drawImage(image, index % 4 * image.width / 4, Math.floor(index / 4) * image.height / 2, image.width / 4, image.height / 2, 0, 0, 512, 512)
          const pixels = ctx.getImageData(0, 0, 512, 512), d = pixels.data
          for (let i = 0; i < d.length; i += 4) {
            const alpha = luckycatAlpha(d[i], d[i + 1], d[i + 2])
            d[i + 3] = Math.round(d[i + 3] * alpha)
            if (!alpha) { d[i] = d[i + 1] = d[i + 2] = 0; continue }
            if (alpha < 1) {
              d[i] = Math.min(255, d[i] / alpha); d[i + 2] = Math.min(255, d[i + 2] / alpha)
              d[i + 1] = Math.min(d[i + 1], Math.max(d[i], d[i + 2]))
            }
          }
          ctx.putImageData(pixels, 0, 0)
          return canvas.toDataURL('image/png')
        })
        resolve(frames)
      } catch (error) { pending = undefined; reject(error) }
    }
    image.src = LUCKYCAT_ASSET
  })
}

/** Remove only green connected to the cell exterior, preserving enclosed green jewels. */
export function catBackgroundMask(d:Uint8ClampedArray,w:number,h:number):Uint8Array{
 const mask=new Uint8Array(w*h),queue=new Uint32Array(w*h);let read=0,write=0
 const enqueue=(pixel:number)=>{if(mask[pixel])return;const i=pixel*4;if(luckycatAlpha(d[i],d[i+1],d[i+2])>=1)return;mask[pixel]=1;queue[write++]=pixel}
 for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x)}
 for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1)}
 while(read<write){const i=queue[read++]!,x=i%w,y=Math.floor(i/w);if(x>0)enqueue(i-1);if(x<w-1)enqueue(i+1);if(y>0)enqueue(i-w);if(y<h-1)enqueue(i+w)}
 return mask
}
export function catPartBounds(d:Uint8ClampedArray,w:number,h:number):[number,number,number,number]{
 const seen=new Uint8Array(w*h),queue=new Uint32Array(w*h);let largest=0,bounds:[number,number,number,number]=[w,h,0,0]
 for(let seed=0;seed<w*h;seed++){
  if(seen[seed]||d[seed*4+3]<=20)continue
  let read=0,write=1,x0=w,y0=h,x1=0,y1=0;queue[0]=seed;seen[seed]=1
  const add=(n:number)=>{if(!seen[n]&&d[n*4+3]>20){seen[n]=1;queue[write++]=n}}
  while(read<write){const n=queue[read++]!,x=n%w,y=Math.floor(n/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);if(x) add(n-1);if(x<w-1)add(n+1);if(y)add(n-w);if(y<h-1)add(n+w)}
  if(write>largest){largest=write;bounds=[x0,y0,x1,y1]}
 }
 return bounds
}
import type { LuckyCatSkin } from '../shared/types'
export interface CatRig { cells: HTMLCanvasElement[]; props: HTMLCanvasElement[] }
const rigs: Partial<Record<LuckyCatSkin,Promise<CatRig>>>={}
let propsPending:Promise<HTMLCanvasElement[]>|undefined
// Measured green gutters, rather than assumed square rows, preserve hats and fur.
const rigRows=[0,421/1086,735/1086,1]
function decodeParts(path:string,rig:boolean):Promise<HTMLCanvasElement[]>{
 return new Promise((resolve,reject)=>{
  const image=new Image();image.onerror=()=>reject(new Error('招财猫服装素材未能加载'))
  image.onload=()=>{try{
   const count=rig?12:4
   const cells=Array.from({length:count},(_,i)=>{
    const row=Math.floor(i/4),col=i%4
    const columns=rig&&row===1?[0,375/1448,735/1448,1090/1448,1]:[0,.25,.5,.75,1]
    const top=rig?rigRows[row]!:0,bottom=rig?rigRows[row+1]!:1
    const sx=Math.round(columns[col]!*image.width),sy=Math.round(top*image.height)
    const w=Math.round(columns[col+1]!*image.width)-sx,h=Math.round(bottom*image.height)-sy
    const c=document.createElement('canvas');c.width=w;c.height=h
    const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,sx,sy,w,h,0,0,w,h)
    const pixels=ctx.getImageData(0,0,w,h),d=pixels.data,mask=catBackgroundMask(d,w,h);let x0=w,y0=h,x1=0,y1=0
    for(let p=0;p<d.length;p+=4){const a=mask[p/4]?luckycatAlpha(d[p],d[p+1],d[p+2]):1;d[p+3]=Math.round(d[p+3]*a)
     if(!a){d[p]=d[p+1]=d[p+2]=0;continue}
     if(a<1){d[p]=Math.min(255,d[p]/a);d[p+2]=Math.min(255,d[p+2]/a);d[p+1]=Math.min(d[p+1],Math.max(d[p],d[p+2]))}
     if(d[p+3]>20){const x=(p/4)%w,y=Math.floor(p/4/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
    }
    if(rig&&i>=4)[x0,y0,x1,y1]=catPartBounds(d,w,h)
    if(x0>x1||y0>y1)throw Error('空白动画部件')
    ctx.putImageData(pixels,0,0);x0=Math.max(0,x0-2);y0=Math.max(0,y0-2);x1=Math.min(w-1,x1+2);y1=Math.min(h-1,y1+2)
    const trimmed=document.createElement('canvas');trimmed.width=x1-x0+1;trimmed.height=y1-y0+1
    trimmed.getContext('2d')!.drawImage(c,x0,y0,trimmed.width,trimmed.height,0,0,trimmed.width,trimmed.height)
    return trimmed
   });resolve(cells)
  }catch(error){reject(error)}}
  image.src=path
 })
}
export function loadCatRig(skin:LuckyCatSkin):Promise<CatRig>{
 return rigs[skin]??=(async()=>{try{
  propsPending??=decodeParts('./assets/luckycat/props.png',false).catch(e=>{propsPending=undefined;throw e})
  const [cells,props]=await Promise.all([decodeParts(`./assets/luckycat/outfits/${skin}.png`,true),propsPending]);return {cells,props}
 }catch(e){delete rigs[skin];throw e}})()
}
