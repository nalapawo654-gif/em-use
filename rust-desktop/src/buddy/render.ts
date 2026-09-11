import type { BuddySkin } from '../shared/types'
import { durations, type BuddyAction } from './play'
import type { BuddyMotion } from './motion'
import type { BuddyRig, BuddyProp } from './sprites'

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, Math.max(.1, ry), 0, 0, Math.PI * 2); ctx.fill()
}
function line(ctx: CanvasRenderingContext2D, points: number[], color: string, width = 2) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(points[0], points[1]); ctx.quadraticCurveTo(points[2], points[3], points[4], points[5]); ctx.stroke()
}
function facial(ctx: CanvasRenderingContext2D, skin: BuddySkin, m: BuddyMotion) {
  const classic = skin === 'classic', dark = skin === 'midnight'
  const eyes = classic ? [[.215,.425,.035,.047],[.61,.51,.043,.055]] : [[.20,.41,.029,.041],[.56,.45,.038,.05]]
  const ink = dark ? '#111a21' : '#292019'
  const happy = m.expression === 'happy', sleepy = m.expression === 'sleepy', annoyed = m.expression === 'annoyed'
  for (const [x,y,rx,ry] of eyes) {
    const xx = x * 260, yy = y * 254, w = rx * 260, h = ry * 254
    const open = Math.max(0, m.eyeOpen)
    if (open < .22) {
      line(ctx, [xx-w,yy+1,xx,yy+(happy?-h*.85:h*.7),xx+w,yy+1], dark?'#ccd9df':ink, 2.8)
      if (happy) line(ctx, [xx-w*1.2,yy+h,xx,yy+h+3,xx+w*1.2,yy+h], '#ee999378', 2)
    } else {
      ctx.save(); ctx.beginPath(); ctx.ellipse(xx, yy, w+1, h*open+1, -.12, 0, Math.PI*2); ctx.clip()
      const shade = ctx.createLinearGradient(xx, yy-h, xx+w, yy+h); shade.addColorStop(0,'#40352e'); shade.addColorStop(.5,'#090c11'); shade.addColorStop(1,'#3e4348')
      ctx.fillStyle=shade; ctx.fillRect(xx-w-2,yy-h-2,w*2+4,h*2+4)
      ellipse(ctx,xx+m.lookX,yy+m.lookY,w*.75,h*.85,'#0a111b')
      ellipse(ctx,xx-w*.22+m.lookX*.35,yy-h*.28+m.lookY*.25,w*.30,h*.23,'#ffffffed')
      ellipse(ctx,xx+w*.32,yy+h*.38,w*.12,h*.10,'#a5c7daaa'); ctx.restore()
    }
    if (annoyed) line(ctx,[xx-w*1.1,yy-h-5,xx,yy-h-3,xx+w*.95,yy-h+1],dark?'#8799a5':'#785239',2.6)
    else if (sleepy) line(ctx,[xx-w,yy-h-4,xx,yy-h-7,xx+w,yy-h-4],dark?'#67727a':'#a78b6c',1.6)
    else if (m.expression === 'surprised') line(ctx,[xx-w,yy-h-9,xx,yy-h-14,xx+w,yy-h-9],dark?'#67727a':'#9b6849',2)
  }
  const x = (classic ? .265 : .26)*260, y=(classic ? .88 : .86)*254
  const opening = m.mouth
  if (happy) {
    ctx.save();ctx.beginPath();ctx.moveTo(x-11,y-3);ctx.quadraticCurveTo(x,y+1,x+11,y-3);ctx.quadraticCurveTo(x+9,y+11,x,y+12);ctx.quadraticCurveTo(x-10,y+10,x-11,y-3);ctx.closePath();ctx.clip()
    ctx.fillStyle='#753725';ctx.fillRect(x-12,y-4,24,18);ellipse(ctx,x+1,y+10,7,4,'#f3a098');ctx.restore()
    line(ctx,[x-13,y-2,x-12,y-4,x-11,y-4],'#ae7050',1.2)
    line(ctx,[x+11,y-4,x+12,y-5,x+13,y-2],'#ae7050',1.2)
  } else if (annoyed && opening < .06) line(ctx,[x-8,y+3,x,y-4,x+8,y+3],'#9c5d3c',1.8)
  else if (m.expression === 'drinking') {
    ellipse(ctx,x,y,4+opening*2,2+opening*4,'#824a35'); ellipse(ctx,x,y+1,2.5,1.6+opening*2,'#3b241f')
  } else if (opening > .06) {
    const width= m.expression==='chewing'? 7 + Math.sin(opening*5)*2 : 9
    ctx.save(); ctx.beginPath(); ctx.ellipse(x,y,width,2+opening*9, -.1,0,Math.PI*2);ctx.clip()
    ctx.fillStyle='#613020';ctx.fillRect(x-12,y-14,24,28)
    ellipse(ctx,x+1,y+5,width*.8,3+opening*3,'#ef8f88')
    if (m.expression==='chewing') { ctx.fillStyle='#fff7d9';ctx.fillRect(x-5,y-9,10,4) }
    ctx.restore();line(ctx,[x-9,y-1,x,y-2,x+8,y-2],'#b7775266',1)
  } else line(ctx,[x-8,y-2,x,y+7,x+9,y-3], '#9c5d3c',1.8)
}

export function renderBuddy(ctx: CanvasRenderingContext2D, rig: BuddyRig, skin: BuddySkin, action: BuddyAction, elapsed: number, m: BuddyMotion, deflation: number) {
  ctx.clearRect(0,0,512,512)
  const air=Math.min(3,Math.max(0,deflation)), lower=Math.floor(air), heights=[0,.07,.28,.48]
  const flatten=heights[lower]+((heights[Math.min(3,lower+1)]-heights[lower])*(air-lower))
  // The baseline stays fixed. Air loss compresses the torso and lowers the neck.
  const low = flatten * 150, bodyH = 236 * (1-flatten), bodyY = 484-bodyH+m.bodyY
  const eating=action==='feed'||action==='drink', bend=eating?Math.min(1,Math.max(0,-m.headAngle/.48)):0
  const neckOffset=(skin==='classic'?flatten*30:20)*(1-bend)
  const headX=65+(skin==='classic'?0:20)+m.headX, headY=48+low+m.headY+neckOffset
  const pivotX=230+(skin==='classic'?0:20)+m.headX, pivotY=282+low+m.headY+neckOffset
  const tailX=402, tailY=bodyY+bodyH*.36
  ctx.save();ctx.translate(tailX,tailY);ctx.rotate(m.tailAngle);ctx.drawImage(rig.tail,-6,-90,94,105);ctx.restore()
  ctx.save();ctx.translate(0,484);ctx.scale(1,m.bodyScale);ctx.translate(0,-484)
  // Front leg bends independently for the kick; the rest of the body stays planted.
  if (m.foot > .001) {
    drawKickingBody(ctx,rig.body,140,bodyY,300,bodyH,m.foot)
  } else if (bend > .001) {
    // Flex the shoulder down while every hoof and the hindquarters stay on the
    // baseline. Adjacent strips share their boundary, so there is no cut-out neck.
    for(let i=0;i<100;i++) {
      const u=i/100, drop=90*bend*(1-u)*(1-flatten)
      ctx.drawImage(rig.body,u*rig.body.width,0,rig.body.width/100,rig.body.height,140+u*300,bodyY+drop,3.15,bodyH-drop)
    }
  } else ctx.drawImage(rig.body,140,bodyY,300,bodyH)
  ctx.restore()
  const headTransform=()=>{ctx.translate(pivotX,pivotY);ctx.rotate(m.headAngle);ctx.translate(headX-pivotX,headY-pivotY)}
  ctx.save();headTransform();ctx.drawImage(rig.head,0,0,260,254);facial(ctx,skin,m);ctx.restore()
  // Mouth world coordinates are derived from the same head transform as the art.
  const localX=(skin==='classic'?.265:.26)*260+headX-pivotX, localY=(skin==='classic'?.88:.86)*254+headY-pivotY
  const mouthX=pivotX+Math.cos(m.headAngle)*localX-Math.sin(m.headAngle)*localY
  const mouthY=pivotY+Math.sin(m.headAngle)*localX+Math.cos(m.headAngle)*localY
  const opacity = action === 'idle' ? 0 : Math.min(1,elapsed/350,action === 'clean' ? 1 : Math.max(0,(durations[action]-elapsed)/700))
  const prop=(name: BuddyProp,x:number,y:number,w:number,h:number,rotate=0,alpha=1)=>{const img=rig.props[name];if(!img)return;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x+w/2,y+h/2);ctx.rotate(rotate);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore()}
  if(action==='feed') {
    const reach=Math.min(1,elapsed/900), fade=m.phase==='recover'?Math.max(0,(5800-elapsed)/900):1
    // The tip reaches the lips; the tuft is eaten from its root towards the mouth.
    const size=24+70*m.grass, x=mouthX-16-(1-reach)*65, y=mouthY-8+(1-reach)*95
    prop('grass',x-size*.48,y,size,size*.82,Math.sin(elapsed/110)*.025,opacity*fade)
    if(m.phase==='perform') {ctx.save();ctx.translate(mouthX,mouthY);ctx.rotate(m.headAngle);line(ctx,[-2,1,-10,7,-18-m.grass*12,14],'#57982b',2);line(ctx,[-3,2,-13,12,-24*m.grass,20],'#77ae32',1.6);ctx.restore()}
  }
  if(action==='drink') {
    const fade=m.phase==='recover'?Math.max(0,(6200-elapsed)/900):1
    const bucketX=skin==='classic'?88:108,bucketY=400
    prop('water',bucketX,bucketY,86,84,0,opacity*fade)
    ctx.save();ctx.globalAlpha=opacity*fade
    ellipse(ctx,bucketX+43,bucketY+10,30,8,'#38a6cf')
    ctx.strokeStyle='#b4f3f4';ctx.lineWidth=1.4
    for(let i=0;i<2;i++){const radius=7+((elapsed/70+i*15)%24);ctx.beginPath();ctx.ellipse(bucketX+43,bucketY+10,radius,radius*.24,0,0,Math.PI*2);ctx.stroke()}
    if(m.phase==='perform') {line(ctx,[mouthX,mouthY+2,mouthX-2,mouthY+9,mouthX,mouthY+13],'#84e5f1',2.5); for(let i=0;i<3;i++)ellipse(ctx,mouthX+20+i*6,bucketY-4+Math.sin(elapsed/150+i)*5,1.2,2,'#8de4ee')}
    ctx.restore()
  }
  if(action==='swat') prop('mosquito',m.bugX-13,m.bugY-13,26,26,Math.sin(elapsed/35)*.18,m.bugAlpha)
  if(action==='pet') prop('hand',headX+96,headY-13+Math.sin(elapsed/230)*6,76,72,-.25,opacity)
  if(action==='play') {
    const kick1=Math.max(0,elapsed-1450), kick2=Math.max(0,elapsed-3650)
    const x=110+Math.sin(Math.min(kick1,2200)/2200*Math.PI)*210+(kick2?Math.sin(kick2/1950*Math.PI)*105:0)
    prop('ball',x,425-Math.abs(Math.sin(kick1/360))*14,65,65,kick1/400,opacity)
  }
  if(action==='inflate') prop('pump',35,380+Math.sin(elapsed/190)*3,73,103,0,opacity)
}

// A continuous mesh bends the front leg without exposing a cut edge or opening
// a triangular hole in the belly. Other hooves remain fixed.
function drawKickingBody(ctx:CanvasRenderingContext2D,img:HTMLCanvasElement,x:number,y:number,w:number,h:number,kick:number) {
  type Vertex={sx:number;sy:number;x:number;y:number}
  const nx=16,ny=12
  const vertex=(u:number,v:number):Vertex=>{
    const leg=Math.max(0,Math.min(1,(v-.57)/.37)), side=1-Math.max(0,Math.min(1,(u-.23)/.24)), weight=leg*leg*side*side
    return {sx:u*img.width,sy:v*img.height,x:x+u*w-Math.sin(kick)*65*weight,y:y+v*h-(1-Math.cos(kick))*130*weight-kick*19*weight}
  }
  const triangle=(p:Vertex,q:Vertex,r:Vertex)=>{
    const ux=q.sx-p.sx,uy=q.sy-p.sy,vx=r.sx-p.sx,vy=r.sy-p.sy,det=ux*vy-vx*uy
    const a=((q.x-p.x)*vy-(r.x-p.x)*uy)/det,c=((r.x-p.x)*ux-(q.x-p.x)*vx)/det
    const b=((q.y-p.y)*vy-(r.y-p.y)*uy)/det,d=((r.y-p.y)*ux-(q.y-p.y)*vx)/det
    const cx=(p.x+q.x+r.x)/3,cy=(p.y+q.y+r.y)/3
    ctx.save();ctx.beginPath()
    for(const [i,z] of [p,q,r].entries()){const dx=z.x-cx,dy=z.y-cy,n=Math.hypot(dx,dy),xx=z.x+dx/n*.24,yy=z.y+dy/n*.24;if(!i)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy)}
    ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,p.x-a*p.sx-c*p.sy,p.y-b*p.sx-d*p.sy);ctx.drawImage(img,0,0);ctx.restore()
  }
  for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){const a=vertex(col/nx,row/ny),b=vertex((col+1)/nx,row/ny),c=vertex(col/nx,(row+1)/ny),d=vertex((col+1)/nx,(row+1)/ny);triangle(a,b,c);triangle(b,d,c)}
}
