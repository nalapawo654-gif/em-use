import { foxBlink, foxEnvelope, foxGroomPose, type FoxMotion } from './ambient'
import type { FoxLevel } from './play'
type Handle = [number, number, number, number]
interface Rig { eyes: Handle[]; head: Handle; ears?: Handle[]; nose?: Handle; tail?: Handle }
// Coordinates are in the actual normalized 512px artwork, not widget pixels.
const RIGS: Record<FoxLevel, Rig> = {
  full: { eyes: [[290,216,36,23],[380,182,18,24]], head:[300,205,200,207], ears:[[165,130,72,105],[343,83,62,95]], nose:[359,210,23,18] },
  unknown: { eyes: [[290,216,36,23],[380,182,18,24]], head:[300,205,200,207], ears:[[165,130,72,105],[343,83,62,95]], nose:[359,210,23,18] },
  medium: { tail:[130,228,132,208], eyes:[], head:[360,228,140,192], ears:[[282,160,70,100],[404,114,53,95]], nose:[413,191,20,18] },
  low: { eyes:[[344,369,29,20],[416,356,20,21]], head:[374,349,133,120], ears:[[289,296,50,86],[438,278,38,80]], nose:[386,398,18,15] },
  empty: { eyes:[[202,372,27,21],[268,371,25,23]], head:[245,374,110,65] },
}
export function createFoxMotionRenderer(source: HTMLCanvasElement, level: FoxLevel, arm?: HTMLCanvasElement) {
  const rig = RIGS[level], src = source.getContext('2d', { willReadFrequently: true })!.getImageData(0,0,512,512)
  const out = new ImageData(512,512), buffer = document.createElement('canvas'); buffer.width = buffer.height = 512
  const bufferCtx = buffer.getContext('2d')!
  const fields = new Map<Handle, Float32Array>()
  for(const h of [rig.head,...(rig.ears ?? []),...(rig.nose ? [rig.nose] : []),...(rig.tail ? [rig.tail] : [])]) {
    const weights = new Float32Array(512*512), [cx,cy,rx,ry] = h
    for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(512,cy+ry);y++) for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(512,cx+rx);x++) {
      const d=Math.max(0,1-((x-cx)/rx)**2-((y-cy)/ry)**2);weights[y*512+x]=d*d*(3-2*d)
    }
    fields.set(h,weights)
  }
  function warp(ctx: CanvasRenderingContext2D, moves: [Handle,number,number][]) {
    out.data.set(src.data)
    const left=Math.max(0,Math.floor(Math.min(...moves.map(m=>m[0][0]-m[0][2])))),right=Math.min(511,Math.ceil(Math.max(...moves.map(m=>m[0][0]+m[0][2]))))
    const top=Math.max(0,Math.floor(Math.min(...moves.map(m=>m[0][1]-m[0][3])))),bottom=Math.min(511,Math.ceil(Math.max(...moves.map(m=>m[0][1]+m[0][3]))))
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const p=y*512+x;let dx=0,dy=0
      for(const [h,mx,my] of moves){const w=fields.get(h)![p];dx+=mx*w;dy+=my*w}
      if(Math.abs(dx)+Math.abs(dy)<.001)continue
      const sx=Math.max(0,Math.min(510.999,x-dx)),sy=Math.max(0,Math.min(510.999,y-dy)),ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,a=(iy*512+ix)*4
      const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy], offsets=[a,a+4,a+2048,a+2052]
      let alpha=0,r=0,g=0,b=0
      for(let k=0;k<4;k++){const i=offsets[k],w=weights[k]*src.data[i+3];alpha+=w;r+=src.data[i]*w;g+=src.data[i+1]*w;b+=src.data[i+2]*w}
      const d=p*4;out.data[d]=alpha?r/alpha:0;out.data[d+1]=alpha?g/alpha:0;out.data[d+2]=alpha?b/alpha:0;out.data[d+3]=alpha
    }
    bufferCtx.putImageData(out,0,0);ctx.drawImage(buffer,0,0)
  }
  function eyelids(ctx: CanvasRenderingContext2D, close: number, moves: [Handle,number,number][]) {
    if(close<=.001)return
    for(const [originalX,originalY,rx,ry] of rig.eyes){
      let x=originalX,y=originalY
      for(const [handle,mx,my] of moves){const weight=fields.get(handle)![Math.round(originalY)*512+Math.round(originalX)];x+=mx*weight;y+=my*weight}
      ctx.save();ctx.beginPath();ctx.ellipse(x,y,rx+2,ry+2,level==='low'?.12:-.18,0,Math.PI*2);ctx.clip()
      // Sample the real adjacent coat, keeping the original authored iris/lash pixels.
      const i=(Math.round(originalY-ry-8)*512+Math.round(originalX))*4
      ctx.fillStyle=level==='empty'?'#151916':`rgb(${src.data[i]},${src.data[i+1]},${src.data[i+2]})`
      ctx.fillRect(x-rx-5,y-ry-5,rx*2+10,ry*2+10)
      const height=Math.max(3.2,ry*2*(1-close))
      ctx.drawImage(source,originalX-rx-2,originalY-ry-2,rx*2+4,ry*2+4,x-rx-2,y-height/2,rx*2+4,height)
      ctx.restore()
      if(close>.65){
        ctx.save();ctx.globalAlpha=(close-.65)/.35;ctx.strokeStyle=level==='empty'?'#f7f6eb':'#272924';ctx.lineWidth=2.6;ctx.lineCap='round'
        ctx.beginPath();ctx.moveTo(x-rx*.84,y+1);ctx.quadraticCurveTo(x,y-ry*.28,x+rx*.84,y-1);ctx.stroke();ctx.restore()
      }
    }
  }
  return (ctx: CanvasRenderingContext2D, motion: FoxMotion | null, progress=0) => {
    ctx.clearRect(0,0,512,512)
    const e=foxEnvelope(progress), moves:[Handle,number,number][]=[], phase=progress*Math.PI*2, grooming=foxGroomPose(progress)
    let close=motion==='blink'?foxBlink(progress):motion==='doze'?e*.97:motion==='groom'?grooming.close*.96:0
    if(motion==='listen'){
      moves.push([rig.head,-9*e,3*e]);rig.ears?.forEach((h,i)=>moves.push([h,(i?-3:5)*Math.sin(phase*.7)*e,-2*e]))
    }
    if(motion==='tail' && rig.tail)moves.push([rig.tail,-7*e,-8*Math.sin(phase*.5)*e])
    if(motion==='sniff' && rig.nose)moves.push([rig.nose,Math.sin(phase*2.3)*2.8*e,-Math.abs(Math.sin(phase*2.3))*2*e])
    if(motion==='doze')moves.push([rig.head,-3*e,5*e])
    if(motion==='groom')moves.push([rig.head,-9*grooming.head,7*grooming.head])
    if(moves.length && e>0)warp(ctx,moves);else ctx.drawImage(source,0,0)
    eyelids(ctx,close,moves)
    if(arm){
      // The base artwork has no near foreleg. This is its only replacement,
      // planted at rest and continuously rotated from the shoulder for grooming.
      const lift=motion==='groom'?grooming.lift:0,stroke=motion==='groom'?grooming.stroke:0
      ctx.save();ctx.translate(313,323);ctx.rotate((144*lift+2.6*stroke)*Math.PI/180)
      ctx.drawImage(arm,-39,-21,78,180);ctx.restore()
    }
  }
}

export async function foxCanvas(url: string, trim = false): Promise<HTMLCanvasElement> {
  const image = new Image();image.src=url;await image.decode()
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0,512,512)
  if(!trim)return canvas
  const d=ctx.getImageData(0,0,512,512).data;let left=512,top=512,right=0,bottom=0
  for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(d[(y*512+x)*4+3]>12){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  if(right<=left || bottom<=top)throw new Error('Empty fox limb')
  const cropped=document.createElement('canvas');cropped.width=right-left+1;cropped.height=bottom-top+1
  cropped.getContext('2d')!.drawImage(canvas,left,top,cropped.width,cropped.height,0,0,cropped.width,cropped.height)
  return cropped
}
