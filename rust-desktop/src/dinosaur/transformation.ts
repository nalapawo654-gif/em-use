import type { DinosaurSkin } from '../shared/types'
import atlas from './transformation-atlas.json'

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const t=clamp(n);return t*t*(3-2*t) }
export type TransformationBeat = 'gather' | 'grow' | 'reveal' | 'settle'
export function dinosaurTransformationTime(elapsed: number, duration: number, reverse = false) {
  const progress=clamp(elapsed/Math.max(1,duration)), t=reverse?1-progress:progress
  const beat:TransformationBeat=t<.1875?'gather':t<.5?'grow':t<.8125?'reveal':'settle'
  return {t,progress,beat,done:progress>=1}
}
const sheet = { pending: undefined as Promise<HTMLImageElement> | undefined }
const costumes = new Map<DinosaurSkin,Promise<HTMLCanvasElement[]>>()
export function loadDinosaurTransformation(skin:DinosaurSkin):Promise<HTMLCanvasElement[]> {
  const old=costumes.get(skin);if(old)return old
  sheet.pending ??= new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{sheet.pending=undefined;reject(new Error('变身关键帧未加载'))}
    image.src=`./assets/evolution/v3/${atlas.file}`
  })
  const result=sheet.pending.then(image=>{
    const rects=atlas.rows[skin],scale=Math.min(430/Math.max(...rects.map(r=>r[2]!)),442/Math.max(...rects.map(r=>r[3]!)))
    return rects.map(([x,y,w,h])=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512
      canvas.getContext('2d')!.drawImage(image,x!,y!,w!,h!,(512-w!*scale)/2,480-h!*scale,w!*scale,h!*scale)
      return canvas
    })
  })
  costumes.set(skin,result);void result.catch(()=>costumes.delete(skin));return result
}
const colors = {
  classic:{light:'#fff0a5',edge:'#54d7ae',dark:'#16715d'},
  peach:{light:'#ffe5ae',edge:'#f394b0',dark:'#ab426a'},
  cream:{light:'#fff1ae',edge:'#f6bd4c',dark:'#b2741f'},
  charcoal:{light:'#ede0ff',edge:'#b297fa',dark:'#604593'},
}
// Timings are shared by the native actor and the scrub-able preview. These are
// authored poses, not a clip-path over a replacement picture.
const keys=[0,.065,.1875,.33,.5,.67,.8125,1]
export function createDinosaurTransformationRenderer(poses:HTMLCanvasElement[], skin:DinosaurSkin) {
  const mix=document.createElement('canvas');mix.width=mix.height=512
  const body=mix.getContext('2d')!, palette=colors[skin]
  function fragment(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,angle:number,alpha:number){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha
    if(skin==='peach'){
      ctx.fillStyle=palette.edge;ctx.beginPath();ctx.ellipse(0,0,r*.65,r,Math.PI/5,0,Math.PI*2);ctx.fill()
      ctx.strokeStyle=palette.light;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,r*.7);ctx.quadraticCurveTo(-r*.3,0,r*.35,-r*.7);ctx.stroke()
    } else {
      ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.55,0);ctx.lineTo(0,r);ctx.lineTo(-r*.55,0);ctx.closePath();ctx.fillStyle=palette.edge;ctx.fill()
      ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.55,0);ctx.lineTo(0,r);ctx.closePath();ctx.fillStyle=palette.light;ctx.fill()
      ctx.strokeStyle=palette.dark;ctx.lineWidth=.8;ctx.stroke()
    }ctx.restore()
  }
  return (ctx:CanvasRenderingContext2D, elapsed:number, duration:number, original:HTMLCanvasElement, target:HTMLCanvasElement, reverse=false) => {
    const time=dinosaurTransformationTime(elapsed,duration,reverse),t=time.t
    ctx.clearRect(0,0,512,512)
    if(t<=0){ctx.drawImage(original,0,0);return time}
    if(t>=1){ctx.drawImage(target,0,0);return time}
    const images=[original,...poses,target]
    let index=0;while(index<keys.length-2&&t>keys[index+1]!)index++
    const local=(t-keys[index]!)/(keys[index+1]!-keys[index]!)
    // Short blended inbetweens preserve solid opacity without ghostly fade-out.
    const blend=smooth((local-.2)/.8)
    body.clearRect(0,0,512,512);body.globalCompositeOperation='source-over';body.globalAlpha=1-blend;body.drawImage(images[index]!,0,0)
    body.globalCompositeOperation='lighter';body.globalAlpha=blend;body.drawImage(images[index+1]!,0,0);body.globalAlpha=1;body.globalCompositeOperation='source-over'
    const gather=Math.sin(Math.PI*clamp(t/.5)),release=Math.sin(Math.PI*clamp((t-.49)/.32))
    const bob=-17*release+4*gather,sy=1-.025*gather+.025*release,sx=1+.018*gather-.012*release
    const energy=smooth(t/.12)*(1-smooth((t-.73)/.27))
    // Far half of the energy ribbon stays BEHIND the actor.
    function ribbon(front:boolean){
      ctx.save();ctx.globalAlpha=energy*.72;ctx.strokeStyle=palette.light;ctx.lineWidth=2.4;ctx.shadowColor=palette.edge;ctx.shadowBlur=9
      for(let ring=0;ring<2;ring++){
        ctx.beginPath()
        for(let n=0;n<=64;n++){
          const a=(front?0:Math.PI)+Math.PI*n/64,spin=t*7+ring*.8
          const x=256+Math.cos(a+spin)*155,y=390-ring*84-t*58+Math.sin(a+spin)*27
          if(n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)
        }ctx.stroke()
      }ctx.restore()
    }
    ribbon(false)
    // Shards spiral in along the spine, then scatter once with the reveal.
    for(let i=0;i<11;i++){
      const birth=.15+i*.019,growth=smooth((t-birth)/.2),burst=smooth((t-.53)/.22)
      const angle=i*2.399+t*2.7,radius=(1-growth)*175+35+burst*110
      const x=282+Math.cos(angle)*radius,y=300+Math.sin(angle)*radius*.76+30*(1-growth)-55*burst
      const alpha=smooth((t-birth)/.06)*(1-smooth((t-.71)/.2))*.8
      fragment(ctx,x,y,(5+i%3*2)*(1-.35*burst),angle,alpha)
    }
    ctx.save();ctx.translate(256,480+bob);ctx.scale(sx,sy);ctx.rotate(-.012*gather+.018*release);ctx.drawImage(mix,-256,-480);ctx.restore()
    ribbon(true)
    // Chest focus, rather than a screen flash. Falls away before the final pose.
    const pulse=energy*(t<.5?.7+.3*Math.sin(t*12):1),x=257,y=338+bob
    ctx.save();ctx.globalAlpha=pulse*.8
    const glow=ctx.createRadialGradient(x,y,0,x,y,54);glow.addColorStop(0,palette.light);glow.addColorStop(.22,palette.edge+'bb');glow.addColorStop(1,palette.edge+'00')
    ctx.fillStyle=glow;ctx.fillRect(x-54,y-54,108,108)
    ctx.translate(x,y);ctx.rotate(t*3);ctx.fillStyle=palette.light;ctx.beginPath();ctx.moveTo(0,-19);ctx.quadraticCurveTo(3,-3,13,0);ctx.quadraticCurveTo(3,3,0,19);ctx.quadraticCurveTo(-3,3,-13,0);ctx.quadraticCurveTo(-3,-3,0,-19);ctx.fill();ctx.restore()
    // Small grounded ring expands once; no permanent floor or background panel.
    ctx.save();ctx.globalAlpha=energy*.35;ctx.strokeStyle=palette.edge;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(256,478,88+74*t,12+7*t,0,0,Math.PI*2);ctx.stroke();ctx.restore()
    return time
  }
}
