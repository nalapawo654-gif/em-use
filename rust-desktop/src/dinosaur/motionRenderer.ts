import type { MailPainter } from '../shared/characterMail'
import { dinosaurMatte } from './sprites'
import { tintDinosaurPixels } from './skins'
import type { DinosaurSkin } from '../shared/types'
import { dinosaurFlight, dinosaurPhone, envelope, ease, type DinosaurMotion } from './ambient'

export const DINOSAUR_PARTS = {
  body: [0, 0, 440, 620], head: [440, 0, 400, 620],
  leftArm: [840, 0, 194, 620], rightArm: [1034, 0, 220, 620],
  leftWing: [0, 620, 420, 634], rightWing: [420, 620, 420, 634], phone: [840, 620, 414, 634],
} as const
export type DinosaurParts = Record<keyof typeof DINOSAUR_PARTS, HTMLCanvasElement>
let pending: Promise<DinosaurParts> | undefined
export function loadDinosaurParts(): Promise<DinosaurParts> {
  return pending ??= new Promise((resolve,reject) => {
    const image = new Image()
    image.onerror = () => { pending=undefined; reject(new Error('小恐龙动画素材未能加载')) }
    image.onload = () => {
      try {
        const result = {} as DinosaurParts
        for (const [key, [x,y,w,h]] of Object.entries(DINOSAUR_PARTS)) {
          const source=document.createElement('canvas');source.width=w;source.height=h
          const ctx=source.getContext('2d',{willReadFrequently:true})!
          ctx.drawImage(image,x/1254*image.width,y/1254*image.height,w/1254*image.width,h/1254*image.height,0,0,w,h)
          const pixels=ctx.getImageData(0,0,w,h),d=pixels.data
          let left:number=w,top:number=h,right=0,bottom=0
          for(let i=0;i<d.length;i+=4){
            const matte=dinosaurMatte(d[i]!,d[i+1]!,d[i+2]!)
            d[i+3]=Math.round(d[i+3]!*(1-matte))
            if(matte>0&&matte<1){const a=1-matte;d[i]=Math.max(0,Math.min(255,(d[i]!-255*matte)/a));d[i+2]=Math.max(0,Math.min(255,(d[i+2]!-255*matte)/a));d[i+1]=Math.min(255,d[i+1]!/a)}
            if(d[i+3]!>24){const px=i/4%w,py=Math.floor(i/4/w);left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py)}
          }
          if(right<=left||bottom<=top)throw Error('Empty dinosaur rig part: '+key)
          ctx.putImageData(pixels,0,0)
          const part=document.createElement('canvas');part.width=right-left+1;part.height=bottom-top+1
          part.getContext('2d')!.drawImage(source,left,top,part.width,part.height,0,0,part.width,part.height)
          result[key as keyof DinosaurParts]=part
        }
        resolve(result)
      } catch(error){pending=undefined;reject(error)}
    }
    image.src='./assets/dinosaur/motion-rig.png'
  })
}
export function createDinosaurMotionRenderer(original: DinosaurParts, skin: DinosaurSkin) {
  const parts={} as DinosaurParts
  for(const [name,source] of Object.entries(original)){
    const copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height
    const ctx=copy.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,0,0)
    if(['body','head','leftArm','rightArm'].includes(name)){
      const pixels=ctx.getImageData(0,0,copy.width,copy.height);tintDinosaurPixels(pixels.data,skin);ctx.putImageData(pixels,0,0)
    }
    parts[name as keyof DinosaurParts]=copy
  }
  const headBuffer=document.createElement('canvas');headBuffer.width=parts.head.width;headBuffer.height=parts.head.height
  const headContext=headBuffer.getContext('2d',{willReadFrequently:true})!
  // Coordinates below are fractions of the inspected, tightly cropped head.
  const eyeSpecs=[[.431,.508,.128,.158],[.798,.418,.092,.13]] as const
  function face(close:number,yawn:number) {
    const w=headBuffer.width,h=headBuffer.height;headContext.clearRect(0,0,w,h);headContext.drawImage(parts.head,0,0)
    for(const [x,y,rx,ry] of eyeSpecs){
      if(close<.01)continue
      const cx=x*w,cy=y*h,rw=rx*w,rh=ry*h
      // Shrink the eye vertically while the upper lid lowers over it. Cover color
      // comes from the actual tinted forehead, keeping every palette coherent.
      const color=headContext.getImageData(Math.round(cx),Math.round(cy-rh-8),1,1).data
      headContext.save();headContext.beginPath();headContext.ellipse(cx,cy,rw+2,rh+3,0,0,Math.PI*2);headContext.clip()
      const grad=headContext.createLinearGradient(cx,cy-rh,cx,cy+rh);grad.addColorStop(0,`rgb(${color[0]},${color[1]},${color[2]})`);grad.addColorStop(1,`rgb(${color[0]!*.93},${color[1]!*.93},${color[2]!*.93})`)
      headContext.fillStyle=grad;headContext.fillRect(cx-rw-3,cy-rh-4,rw*2+6,rh*2+8)
      const open=Math.max(.025,1-close)
      headContext.drawImage(parts.head,cx-rw,cy-rh,rw*2,rh*2,cx-rw,cy-rh*open,rw*2,rh*2*open)
      headContext.restore()
    }
    if(yawn>.01){
      const x=w*.675,y=h*.622,rx=w*.098,ry=h*.045
      const color=headContext.getImageData(Math.round(x),Math.round(y-ry-5),1,1).data
      headContext.save();headContext.globalAlpha=ease(yawn/.22)
      headContext.fillStyle=`rgb(${color[0]},${color[1]},${color[2]})`;headContext.beginPath();headContext.ellipse(x,y,rx*1.17,ry*1.15,0,0,Math.PI*2);headContext.fill()
      const mouth=headContext.createLinearGradient(x,y-35,x,y+35);mouth.addColorStop(0,'#38231e');mouth.addColorStop(.65,'#703029');mouth.addColorStop(1,'#d97768')
      headContext.fillStyle=mouth;headContext.beginPath();headContext.ellipse(x,y+7*yawn,rx*.67*yawn,35*yawn,0,0,Math.PI*2);headContext.fill()
      headContext.fillStyle='#f19489';headContext.beginPath();headContext.ellipse(x,y+27*yawn,rx*.42*yawn,8*yawn,0,0,Math.PI*2);headContext.fill();headContext.restore()
    }
    return headBuffer
  }
  function part(ctx:CanvasRenderingContext2D,name:keyof DinosaurParts,x:number,y:number,w:number,h:number,angle=0,px=.5,py=.5,sx=1,sy=1){
    ctx.save();ctx.translate(x+w*px,y+h*py);ctx.rotate(angle);ctx.scale(sx,sy);ctx.drawImage(parts[name],-w*px,-h*py,w,h);ctx.restore()
  }
  return (ctx:CanvasRenderingContext2D,motion:DinosaurMotion,p:number,mail?:MailPainter) => {
    ctx.clearRect(0,0,512,512)
    const e=envelope(p),flight=dinosaurFlight(p),phone=dinosaurPhone(p)
    const fly=motion==='fly',mobile=motion==='phone',stretch=motion==='stretch',yawn=motion==='yawn',look=motion==='look'
    const headAngle=look?Math.sin(p*Math.PI*3)*.13*e:mobile?.13*phone.hold+.018*phone.nod:yawn?-.06*e:stretch?-.075*e:0
    const headLift=stretch?-10*e:yawn?-5*e:mobile?7*phone.hold:0
    const blink = yawn ? Math.sin(Math.PI*p)**2*.98 : mobile ? Math.max(.16*phone.hold,Math.max(0,1-Math.abs(p-.61)/.04)*.92) : look ? Math.max(0,1-Math.abs(p-.52)/.07)*.95 : 0
    ctx.save()
    if(fly){ctx.translate(256+flight.x,465+flight.y);ctx.rotate(flight.angle);ctx.scale(flight.scale,flight.scale);ctx.translate(-256,-465)}
    // Wings are behind torso; anchored at shoulder roots, not at their centers.
    if(fly&&flight.wings>.001){
      const spread=flight.wings,flap=flight.flap
      part(ctx,'leftWing',15,193,202,211,-.18-flap*.42, .88,.85,spread*(.77+.23*Math.cos(p*Math.PI*30)),spread)
      part(ctx,'rightWing',298,186,196,211,.18+flap*.42,.12,.85,spread*(.77+.23*Math.cos(p*Math.PI*30+.3)),spread)
    }
    part(ctx,'body',83,203,327,272,0,.5,1,1,stretch?1+.045*e:1)
    const armLift=mobile?-12*phone.hold:0
    const leftAngle=stretch?-2.55*e:mobile?-.32*phone.hold:fly?.12*Math.sin(p*Math.PI*24)*e:look?.08*Math.sin(p*Math.PI*3)*e:0
    const rightAngle=stretch?2.55*e:mobile?.30*phone.hold+phone.swipe*.13:fly?-.12*Math.sin(p*Math.PI*24)*e:0
    // Head pivots inside the neck; lower jaw always overlaps the attachment.
    ctx.save();ctx.translate(271,304);ctx.rotate(headAngle);ctx.translate(-271,-304+headLift)
    ctx.drawImage(face(blink,yawn?Math.sin(Math.PI*p)**2*e:0),115,41,306,291);ctx.restore()
    if(mobile&&mail)mail(ctx,{x:240,y:335+(1-phone.hold)*35,width:76,height:129},phone.hold>.2?'held':'lap')
    if(mobile&&!mail&&phone.hold>.001){
      ctx.save();ctx.globalAlpha=phone.hold
      part(ctx,'phone',240,335+(1-phone.hold)*35,76,129,-.05+phone.nod*.018)
      // Small moving highlights convey scrolling without reading any real screen.
      ctx.fillStyle='#ffffffaa';ctx.beginPath();ctx.ellipse(278,392-phone.swipe*12,10,3,0,0,Math.PI*2);ctx.fill();ctx.restore()
    }
    if(mail&&!mobile){
      if(stretch)mail(ctx,{x:423,y:374,width:49,height:91},'ground')
      else mail(ctx,{x:209,y:347,width:64,height:117},'held')
    }
    part(ctx,'leftArm',150+(mobile?26*phone.hold:0),299+armLift,77,93,leftAngle,.28,.2)
    part(ctx,'rightArm',328-(mobile?37*phone.hold:0),293+armLift-(mobile?phone.swipe*8:0),74,94,rightAngle,.72,.2)
    ctx.restore()
    // A few warm glints accompany the wing reveal, and fade before landing.
    if(fly){ctx.save();ctx.globalAlpha=flight.wings*ease((.95-p)/.12)*.6;ctx.strokeStyle='#deb869';ctx.lineWidth=2
      for(let i=0;i<5;i++){const phase=(p*2+i*.19)%1,x=84+i*80+Math.sin(i+p*8)*9,y=370-phase*155;ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+3,y);ctx.moveTo(x,y-3);ctx.lineTo(x,y+3);ctx.stroke()}ctx.restore()}
  }
}
