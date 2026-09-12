import type { CatRig } from './sprites'
import { catPose, envelope } from './motion'
import { luckycatLevel, type LuckyCatAction } from './play'
const rad=(n:number)=>n*Math.PI/180
function fit(ctx:CanvasRenderingContext2D,img:HTMLCanvasElement,x:number,y:number,w:number,h:number){
 const scale=Math.min(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale
 ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)
}
export function drawCat(ctx:CanvasRenderingContext2D,rig:CatRig,percent:number|null,motion:LuckyCatAction='idle',progress=0,options:{puppet?:boolean;time?:number}={}){
 ctx.clearRect(0,0,512,512)
 const level=luckycatLevel(percent),a=rig.cells,props=rig.props
 if(motion==='idle'&&!options.puppet){fit(ctx,a[{full:0,medium:1,low:2,empty:3,unknown:1}[level]]!,28,40,456,436);return}
 const p=catPose(motion,progress),e=envelope(progress),breath=motion==='idle'?Math.sin((options.time??0)/900)*1.3:0
 const sleepy=motion==='box';const headShift=sleepy?28:0
 const drawProp=(index:number,x:number,y:number,w:number,h:number,angle=0)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rad(angle));fit(ctx,props[index]!, -w/2,-h/2,w,h);ctx.restore()}
 if(sleepy)drawProp(2,257,372,350,240)
 // One torso already contains exactly two hind feet and one tail. Forearms are separate.
 ctx.save();ctx.translate(0,-p.stretch*23+breath);ctx.drawImage(a[4]!,120,288,282,169+p.stretch*23);ctx.restore()
 if(motion==='idle'){
  fit(ctx,a[11]!,91,429,68,43);fit(ctx,a[11]!,357,429,72,45)
 }
 // Head expressions share a centered lower-face anchor; crossfade only this layer.
 ctx.save();ctx.translate(256,288+p.headY+headShift+breath);ctx.rotate(rad(p.headAngle))
 const head=(index:number,alpha:number)=>{if(alpha<=0)return;ctx.globalAlpha=alpha;fit(ctx,a[index]!,-169,-230,338,265)}
 head(p.yawn>.45?7:p.closed>.55?6:5,1);ctx.restore()
 const arm=(index:number,x:number,y:number,angle:number,length:number)=>{
  ctx.save();ctx.translate(x,y);ctx.rotate(rad(angle));ctx.drawImage(a[index]!, -31,-12,62,length);ctx.restore()
  return {x:x-Math.sin(rad(angle))*(length-24),y:y+Math.cos(rad(angle))*(length-24)}
 }
 const shoulderY=313-p.stretch*23+breath
 const left=arm(8,153,shoulderY,p.left,p.leftLength),right=arm(9,350,shoulderY,p.right,p.rightLength)
 if(motion==='coffee'){
  ctx.save();ctx.globalAlpha=p.cup;ctx.translate(right.x+8,right.y-24);ctx.rotate(rad(-20*e));fit(ctx,a[10]!,-33,-48,66,96);ctx.restore()
  if(p.cup>.5){ctx.save();ctx.strokeStyle='#ac9985aa';ctx.lineWidth=2;for(let i=0;i<3;i++){const y=right.y-82-(progress*80+i*12)%35;ctx.beginPath();ctx.moveTo(right.x-10+i*12,y);ctx.quadraticCurveTo(right.x-18+i*12,y-12,right.x-10+i*12,y-22);ctx.stroke()}ctx.restore()}
 }
 if(motion==='toss'){
  ctx.save();ctx.globalAlpha=p.prop;ctx.translate(right.x-30*p.goldFlight,right.y-38-160*p.goldFlight);ctx.rotate(rad(p.goldTurn));fit(ctx,a[11]!,-45,-31,90,62);ctx.restore()
 }
 if(motion==='fortune')fit(ctx,a[11]!,right.x-44,right.y-44,88,62)
 if(motion==='gift')drawProp(3,291,378,88,107,-10+e*20)
 if(motion==='fish')drawProp(0,253,350+Math.sin(progress*Math.PI*8)*3,142,124,Math.sin(progress*Math.PI*4)*6)
 if(motion==='work')drawProp(1,261,414,274,145)
 if(sleepy){
  // Only the box front occludes the body, keeping the selected hat and head visible.
  ctx.save();ctx.beginPath();ctx.rect(60,370,410,140);ctx.clip();drawProp(2,257,372,350,240);ctx.restore()
  ctx.save();ctx.fillStyle='#6d452e';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText('摸鱼中',249,446);ctx.restore()
 }
 if(motion==='groom'&&e>.2){ctx.save();ctx.globalAlpha=e;ctx.fillStyle='#e49d98';ctx.font='20px serif';ctx.fillText('♥',left.x-40,left.y-25);ctx.restore()}
}
