import type { BeaverRig } from './sprites'
import type { BeaverAction } from './play'
import type { BeaverSkin } from '../shared/types'
import { BEAVER_WARDROBE } from './wardrobe'
import { beaverMouth, type BeaverMotion } from './motion'
type Art = HTMLCanvasElement
function part(ctx: CanvasRenderingContext2D, image: Art, x: number, y: number, width: number, angle = 0, ax = .5, ay = .5) {
  const height = width * image.height / image.width
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.drawImage(image,-width*ax,-height*ay,width,height); ctx.restore()
}
function arm(ctx: CanvasRenderingContext2D, art: Art, x: number, y: number, handX: number, handY: number, far = false) {
  const distance = Math.hypot(handX-x,handY-y)
  ctx.save(); if (far) ctx.filter='brightness(.8)'
  ctx.translate(x,y);ctx.rotate(Math.atan2(handY-y,handX-x))
  const width=distance+30,height=width*art.height/art.width*.76
  ctx.drawImage(art,-width*.12,-height*.56,width,height);ctx.restore()
}
export function renderBeaver(ctx: CanvasRenderingContext2D, rig: BeaverRig, skin: BeaverSkin, action: BeaverAction, clock: number, m: BeaverMotion) {
  ctx.setTransform(1,0,0,1,64,0); ctx.clearRect(-64,0,640,512)
  const fit = BEAVER_WARDROBE[skin]
  if (m.resting) {
    ctx.save(); ctx.translate(0,470); ctx.scale(1,1+m.breathe); ctx.drawImage(rig.sleeping,0,-470,512,512); ctx.restore()
    return
  }
  ctx.save(); ctx.translate(m.x,m.y)
  const mouth = beaverMouth(m), a = m.amount
  const ball={x:425+Math.sin(m.time/430)*36,y:409-Math.abs(Math.sin(m.time/430))*26}
  part(ctx,rig.tail,203,414,193,m.tail,1,.55)
  // Feet stay on the ground: breathing scales from the seated pelvis.
  ctx.save(); ctx.translate(285,475); ctx.scale(1,(1+m.breathe)*m.bodyScale); part(ctx,rig.body,0,0,280,0,.5,1)
  ctx.restore()
  const holding = action === 'feed' || action === 'drink' || action === 'wood'
  let hand = {x:440*(1-a)+(holding?mouth.x-7:355)*a,y:(292+m.headY)*(1-a)+(holding?mouth.y+52:340+m.paw)*a}
  if (action === 'ball') hand = {x:440*(1-a)+(ball.x-28)*a,y:(292+m.headY)*(1-a)+ball.y*a}
  if (action === 'leaves') hand={x:440*(1-a)+400*a,y:(292+m.headY)*(1-a)+(250+m.paw)*a}
  if (action === 'bird') hand={x:440*(1-a)+465*a,y:(292+m.headY)*(1-a)+226*a}
  arm(ctx,rig.arm,329,298+m.headY*.7,hand.x+9,hand.y-22,true)
  ctx.save(); ctx.translate(334+m.headX,210+m.headY); ctx.rotate(m.head)
  const head=rig.heads[m.level] ?? rig.heads[0]
  // Hat, contact shadows and fur belong to the same head texture and transform.
  // A fixed atlas frame preserves face scale across expressions (no per-frame trim).
  ctx.drawImage(head,fit.x,fit.y,fit.width,fit.width+m.jaw*.35)
  ctx.restore()
  if (a > 0) {
    ctx.save(); ctx.globalAlpha=a
    if(action==='feed') {
      part(ctx,rig.noodles,mouth.x+4,mouth.y+60+(1-a)*45,102,0,.5,.5)
      // The noodle strand joins the cup and mouth and shortens on each slurp.
      ctx.strokeStyle='#efbb57';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(mouth.x,mouth.y+3);ctx.quadraticCurveTo(mouth.x-7-m.chew*6,mouth.y+25,mouth.x+4,mouth.y+42);ctx.stroke()
    } else if(action==='drink') {
      // Bottle neck (not its center) is anchored to the mouth during each gulp.
      part(ctx,rig.water,mouth.x+2,mouth.y+3+(1-a)*75,83,-.95*a+(m.chew*.03),.29,.19)
    } else if(action==='wood') part(ctx,rig.logs,mouth.x+12,mouth.y+34+(1-a)*60,120,-.22,.5,.5)
    else if(action==='ball') part(ctx,rig.ball,ball.x,ball.y,82,m.time/400)
    else if(action==='bird') part(ctx,rig.bird,477+(1-a)*40,194+(1-a)*-110+Math.sin(m.time/170)*3,77,-.05)
    else if(action==='leaves') part(ctx,rig.leaf,405,252+m.paw,58,-.4)
    ctx.restore()
  }
  arm(ctx,rig.arm,292,310+m.headY*.7,hand.x,hand.y)
  if(m.chips) for(let i=0;i<5;i++) {
    const t=((clock/(550+i*45)+i*.23)%1)
    ctx.save();ctx.globalAlpha=(1-t)*.85
    part(ctx,rig.chip,mouth.x+7-t*(24+i*8),mouth.y+12+t*t*120,10+i*2,t*5+i);ctx.restore()
  }
  ctx.restore()
}
