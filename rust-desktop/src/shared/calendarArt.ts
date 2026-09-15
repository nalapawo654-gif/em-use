import { loadImage } from '../aquarium/sprites'
// Decode once per webview, then reuse the exact same keyed image across scene switches.
const cached=new Map<string,Promise<HTMLCanvasElement>>()
export function calendarArt(path:string):Promise<HTMLCanvasElement>{
 let pending=cached.get(path)
 if(!pending){pending=loadImage(path).then(source=>{
  const canvas=document.createElement('canvas');canvas.width=source.naturalWidth;canvas.height=source.naturalHeight
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,0,0)
  const frame=ctx.getImageData(0,0,canvas.width,canvas.height),d=frame.data
  for(let i=0;i<d.length;i+=4){const matte=Math.max(0,Math.min(1,(d[i+1]-Math.max(d[i],d[i+2])-25)/85));d[i+3]=Math.round(d[i+3]*(1-matte));if(matte>0&&matte<1)d[i+1]=Math.min(d[i+1],Math.max(d[i],d[i+2]))}
  ctx.putImageData(frame,0,0);return canvas
 }).catch(error=>{cached.delete(path);throw error});cached.set(path,pending)}
 return pending
}
