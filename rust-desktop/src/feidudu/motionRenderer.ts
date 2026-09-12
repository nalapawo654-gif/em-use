import { motionEnvelope, type FeiduduMotion } from './ambient'
import { feiduduLayout } from './sprites'

type Point = [number, number]
type Eye = [number, number, number, number]
type Handle = [number, number, number, number]
interface Rig { eyes: Eye[]; ears: Handle[]; nose: Handle; head: Handle; mouth?: Point; arm?: Handle; foot?: Handle; belly?: Handle }
// Landmarks refer to the actual authored atlas, then follow its crop/scale metadata.
const RIGS: Rig[] = [
  { eyes: [[201,163,15,17],[252,173,18,18]], ears: [[225,78,51,73],[321,102,67,56]], nose:[182,224,43,34], head:[240,190,119,130], mouth:[195,265], arm:[265,327,52,31], foot:[255,405,43,49], belly:[198,358,71,73] },
  { eyes: [[591,165,16,17],[640,174,18,19]], ears:[[620,80,51,74],[714,101,63,57]], nose:[558,224,41,33], head:[634,185,115,115] },
  { eyes: [[1027,191,15,17],[1076,211,17,18]], ears:[[1047,124,48,70],[1141,159,61,54]], nose:[989,254,43,34], head:[1061,222,119,127], mouth:[1009,294], arm:[1145,362,40,53], foot:[1028,407,51,40], belly:[1008,361,91,61] },
  { eyes: [[139,673,16,17],[183,690,18,18]], ears:[[163,594,47,68],[258,626,64,48]], nose:[105,733,41,34], head:[160,714,100,84], mouth:[128,771] },
  { eyes: [[544,725,14,15],[586,738,16,17]], ears:[[582,655,47,48],[662,682,53,38]], nose:[527,772,38,27], head:[582,753,100,48] },
]
interface Field { weights: Float32Array; bounds: [number,number,number,number] }
export function createFeiduduMotionRenderer(source: HTMLCanvasElement, original: HTMLCanvasElement, frame: number) {
  const raw = RIGS[frame]
  if (!raw) return null
  const layout = feiduduLayout(original), scale = layout.scale
  const point = ([x,y]: Point): Point => [x * scale + layout.x, y * scale + layout.y]
  const handle = ([x,y,rx,ry]: Handle): Handle => [...point([x,y]), rx * scale, ry * scale]
  const rig: Rig = { eyes:raw.eyes.map(handle), ears:raw.ears.map(handle), nose:handle(raw.nose), head:handle(raw.head), mouth:raw.mouth && point(raw.mouth), arm:raw.arm && handle(raw.arm), foot:raw.foot && handle(raw.foot), belly:raw.belly && handle(raw.belly) }
  const src = source.getContext('2d', { willReadFrequently: true })!.getImageData(0,0,512,512)
  const output = new ImageData(512,512)
  function field(h: Handle): Field {
    const [cx,cy,rx,ry] = h, weights = new Float32Array(512 * 512)
    const bounds: Field['bounds'] = [Math.max(0,Math.floor(cx-rx-18)),Math.max(0,Math.floor(cy-ry-18)),Math.min(511,Math.ceil(cx+rx+18)),Math.min(511,Math.ceil(cy+ry+18))]
    for (let y=bounds[1]; y<=bounds[3]; y++) for(let x=bounds[0]; x<=bounds[2]; x++) {
      const d = Math.max(0,1-((x-cx)/rx)**2-((y-cy)/ry)**2)
      weights[y*512+x] = d*d*(3-2*d)
    }
    return { weights, bounds }
  }
  const ears = rig.ears.map(field), nose = field(rig.nose), head = field(rig.head)
  const arm = rig.arm && field(rig.arm), foot = rig.foot && field(rig.foot), belly = rig.belly && field(rig.belly)
  const offscreen = document.createElement('canvas'); offscreen.width = offscreen.height = 512
  const offctx = offscreen.getContext('2d')!
  type Move = [Field, number, number]
  function warp(ctx: CanvasRenderingContext2D, moves: Move[]) {
    output.data.set(src.data)
    const left=Math.min(...moves.map(m=>m[0].bounds[0])), top=Math.min(...moves.map(m=>m[0].bounds[1])), right=Math.max(...moves.map(m=>m[0].bounds[2])), bottom=Math.max(...moves.map(m=>m[0].bounds[3]))
    for(let y=top; y<=bottom; y++) for(let x=left; x<=right; x++) {
      const p=y*512+x; let dx=0,dy=0
      for(const [f,mx,my] of moves) { const w=f.weights[p]!; dx+=mx*w;dy+=my*w }
      if(Math.abs(dx)+Math.abs(dy)<.001) continue
      const sx=Math.max(0,Math.min(510.999,x-dx)), sy=Math.max(0,Math.min(510.999,y-dy))
      const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy, a=(iy*512+ix)*4
      // Bilinear, premultiplied-alpha sampling keeps the transparent outline clean.
      const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy], offsets=[a,a+4,a+2048,a+2052]
      let alpha=0,r=0,g=0,b=0
      for(let k=0;k<4;k++) { const o=offsets[k]!,w=weights[k]!*src.data[o+3]!;alpha+=w;r+=src.data[o]!*w;g+=src.data[o+1]!*w;b+=src.data[o+2]!*w }
      const dest=p*4;output.data[dest]=alpha?r/alpha:0;output.data[dest+1]=alpha?g/alpha:0;output.data[dest+2]=alpha?b/alpha:0;output.data[dest+3]=alpha
    }
    offctx.putImageData(output,0,0);ctx.drawImage(offscreen,0,0)
  }
  function eyes(ctx: CanvasRenderingContext2D, gazeX:number,gazeY:number,close:number,opacity:number) {
    ctx.save();ctx.globalAlpha=opacity
    for(const [x,y,rx,ry] of rig.eyes) {
      const sample=(Math.round(y-ry-5)*512+Math.round(x))*4
      ctx.save();ctx.beginPath();ctx.ellipse(x,y,rx+3.5*scale,ry+3.5*scale,0,0,Math.PI*2);ctx.clip()
      ctx.fillStyle=`rgb(${src.data[sample]},${src.data[sample+1]},${src.data[sample+2]})`;ctx.fillRect(x-rx-4*scale,y-ry-4*scale,rx*2+8*scale,ry*2+8*scale)
      const open=Math.max(.025,1-close)
      ctx.beginPath();ctx.ellipse(x,y,rx,ry*open,0,0,Math.PI*2);ctx.clip()
      const white=ctx.createRadialGradient(x-rx*.3,y-ry*.4,1,x,y,ry*1.2);white.addColorStop(0,'#fffef6');white.addColorStop(1,'#e1d3b6');ctx.fillStyle=white;ctx.fillRect(x-rx,y-ry,rx*2,ry*2)
      const px=x+rx*(.18+gazeX*.32),py=y+gazeY*ry*.27,pr=rx*.64
      const iris=ctx.createRadialGradient(px-2,py-2,0,px,py,pr);iris.addColorStop(0,'#23130b');iris.addColorStop(.7,'#442610');iris.addColorStop(1,'#895229')
      ctx.fillStyle=iris;ctx.beginPath();ctx.ellipse(px,py,pr,pr*1.08,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fffaf0';ctx.beginPath();ctx.arc(px-pr*.32,py-pr*.37,pr*.23,0,Math.PI*2);ctx.fill();ctx.restore()
      if(close>.8){ctx.strokeStyle='#593217';ctx.lineWidth=2.3*scale;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-rx*.8,y);ctx.quadraticCurveTo(x,y+ry*.22,x+rx*.8,y);ctx.stroke()}
    }
    ctx.restore()
  }
  return (ctx:CanvasRenderingContext2D, motion:FeiduduMotion, progress:number, variation=1) => {
    const e=motionEnvelope(progress), phase=progress*Math.PI*2, moves:Move[]=[]
    ctx.clearRect(0,0,512,512)
    if(motion==='ears') ears.forEach((ear,i)=>moves.push([ear,Math.sin(phase*2.8+i*1.6)*15*e*scale,Math.cos(phase*2.8+i)*3*e*scale]))
    if(motion==='belly' && arm && belly){moves.push([arm,(Math.sin(phase*2.2)*14-12)*e*scale,(Math.cos(phase*2.2)-.3)*12*e*scale],[belly,Math.sin(phase*2.2)*2*e*scale,Math.cos(phase*2.2)*3*e*scale])}
    if(motion==='nod') moves.push([head,Math.sin(phase)*3*e*scale,(1-Math.cos(phase*1.7))*7*e*scale])
    if(motion==='stretch'){moves.push([head,0,-12*e*scale]);ears.forEach((ear,i)=>moves.push([ear,(i?1:-1)*5*e*scale,-7*e*scale]));if(arm)moves.push([arm,9*e*scale,-10*e*scale]);if(belly)moves.push([belly,0,-4*e*scale])}
    if(motion==='foot' && foot) moves.push([foot,Math.sin(phase*3)*5*e*scale,-(1-Math.cos(phase*3))*7*e*scale])
    if(motion==='sniff') moves.push([nose,Math.sin(phase*4)*3.2*e*scale,-Math.abs(Math.sin(phase*4))*2*e*scale])
    if(moves.length && e>0) warp(ctx,moves);else ctx.drawImage(source,0,0)
    if(motion==='eyes') eyes(ctx,Math.sin(phase*1.25)*variation,-Math.cos(phase*1.25),0,e)
    if(motion==='blink') { const blink=(center:number,width:number)=>Math.max(0,1-Math.abs(progress-center)/width);eyes(ctx,0,0,Math.max(blink(.3,.09),blink(.63,.085)),e) }
    if(motion==='yawn' && rig.mouth){
      const open=Math.sin(Math.PI*progress)**2*e,[x,y]=rig.mouth, rx=10*scale*open,ry=19*scale*open
      eyes(ctx,0,0,open*.96,e)
      if(open>.01){ctx.save();ctx.globalAlpha=e;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,-.05,Math.PI*2);const mouth=ctx.createLinearGradient(x,y-ry,x,y+ry);mouth.addColorStop(0,'#512710');mouth.addColorStop(.6,'#6b2c1b');mouth.addColorStop(1,'#c67557');ctx.fillStyle=mouth;ctx.fill();ctx.strokeStyle='#a76b2c';ctx.lineWidth=1.2*scale;ctx.stroke();ctx.restore()}
    }
  }
}
