<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { SkadiAction } from '../skadi/play'
import type { SkadiForm,SkadiSkin,SkadiWeapon } from '../shared/types'
import { loadSkadiWeapons,skadiWeaponPoint } from '../skadi/sprites'
import { SKADI_WEAPON_INDEX } from '../skadi/motion'
import { skadiHands,skadiHeldScale,WEAPON_GRIPS } from '../skadi/rig'
import { skadiVertex } from '../skadi/deform'
const props=defineProps<{src:string;action:SkadiAction;paused:boolean;gentle:boolean;form:SkadiForm;skin:SkadiSkin;frame:number;weapon:SkadiWeapon;showWeapon:boolean}>()
const canvas=ref<HTMLCanvasElement>(), failed=ref(false),ready=ref(false);let artwork:HTMLImageElement|undefined,raf=0,disposed=false,version=0,last=0
const imageCache=new Map<string,HTMLImageElement>()
let weaponArt:HTMLImageElement[]=[]
const composite=document.createElement('canvas');composite.width=composite.height=512
function compose(ms:number):CanvasImageSource{
 if(!artwork)return composite
 const ctx=composite.getContext('2d')!;ctx.clearRect(0,0,512,512);ctx.drawImage(artwork,0,0)
 if(!props.showWeapon||!weaponArt.length)return composite
 const id=SKADI_WEAPON_INDEX[props.weapon],img=weaponArt[id],hands=skadiHands(props.form,props.skin,props.frame)
 const main=props.frame===2||props.frame===3&&props.form==='adult'?1:0
 const sides=props.weapon==='twins'?[0,1]:[main]
 for(const side of sides){
  const hand=hands[side],grip=skadiWeaponPoint(id,props.weapon==='twins'?(side===0?[165,129]:[350,129]):WEAPON_GRIPS[props.weapon])
  const mirror=props.weapon==='twins'?false:props.weapon==='sword'?side===1:side===0
  let angle=props.frame===4?-1.1:props.frame===3&&['staff','scythe','bow'].includes(props.weapon)?(side===1?1.0:-1.0):props.weapon==='scythe'?(side===0?-.45:.45):0
  if(!props.gentle&&!props.paused&&!media.matches&&props.action==='blade')angle+=Math.sin(ms/180)*.18
  let scale=skadiHeldScale(props.form,props.weapon,props.frame)
  const cos=Math.cos(angle),sin=Math.sin(angle),sign=mirror?-1:1
  // Fit the complete weapon inside the same square as the character, using its grip as pivot.
  const left=props.weapon==='twins'&&side===1?256:28,right=props.weapon==='twins'&&side===0?256:484
  for(const [x,y] of [[left,28],[right,28],[right,484],[left,484]]){
   const dx=(x-grip[0])*sign,dy=y-grip[1],rx=dx*cos-dy*sin,ry=dx*sin+dy*cos
   if(rx>0)scale=Math.min(scale,(502-hand[0])/rx);else if(rx<0)scale=Math.min(scale,(10-hand[0])/rx)
   if(ry>0)scale=Math.min(scale,(502-hand[1])/ry);else if(ry<0)scale=Math.min(scale,(10-hand[1])/ry)
  }
  ctx.save();ctx.translate(hand[0],hand[1]);ctx.rotate(angle);ctx.scale(scale*sign,scale);ctx.translate(-grip[0],-grip[1])
  if(props.weapon==='twins'){const middle=skadiWeaponPoint(id,[256,0])[0];ctx.beginPath();ctx.rect(side===0?0:middle,0,side===0?middle:512-middle,512);ctx.clip()}
  ctx.drawImage(img,0,0);ctx.restore()
  // The palm stays in front of the hilt, so the handle passes through the grasp.
  if(props.frame!==4){ctx.save();ctx.beginPath();ctx.ellipse(hand[0],hand[1],props.form==='adult'?7:9,props.form==='adult'?10:12,0,0,Math.PI*2);ctx.clip();ctx.drawImage(artwork,0,0);ctx.restore()}
 }
 return composite
}
function triangle(ctx:CanvasRenderingContext2D,img:CanvasImageSource,s:number[][],d:number[][]){
 const [a,b,c]=s,[p,q,r]=d,det=a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1])
 if(!det)return
 const affine=(v:number[])=>[(v[0]*(b[1]-c[1])+v[1]*(c[1]-a[1])+v[2]*(a[1]-b[1]))/det,(v[0]*(c[0]-b[0])+v[1]*(a[0]-c[0])+v[2]*(b[0]-a[0]))/det,(v[0]*(b[0]*c[1]-c[0]*b[1])+v[1]*(c[0]*a[1]-a[0]*c[1])+v[2]*(a[0]*b[1]-b[0]*a[1]))/det]
 const u=affine([p[0],q[0],r[0]]),v=affine([p[1],q[1],r[1]])
 // Slightly overlap adjacent clips to prevent antialiased triangle seams.
 const center=[(p[0]+q[0]+r[0])/3,(p[1]+q[1]+r[1])/3]
 const clip=[p,q,r].map(v=>{const dx=v[0]-center[0],dy=v[1]-center[1],len=Math.hypot(dx,dy);return [v[0]+dx/len*.6,v[1]+dy/len*.6]})
 ctx.save();ctx.beginPath();ctx.moveTo(clip[0][0],clip[0][1]);ctx.lineTo(clip[1][0],clip[1][1]);ctx.lineTo(clip[2][0],clip[2][1]);ctx.closePath();ctx.clip();ctx.setTransform(u[0],v[0],u[1],v[1],u[2],v[2]);ctx.drawImage(img,0,0);ctx.restore()
}
function paint(ms:number){
 const ctx=canvas.value?.getContext('2d');if(!ctx||!artwork)return
 ctx.clearRect(0,0,512,512)
 const figure=compose(ms)
 if(props.gentle||props.paused||document.hidden||media.matches){ctx.drawImage(figure,0,0,512,512);return}
 const n=12,m=16,t=ms/1000
 for(let y=0;y<m;y++)for(let x=0;x<n;x++){
 const s=[[x/n,y/m],[(x+1)/n,y/m],[(x+1)/n,(y+1)/m],[x/n,(y+1)/m]]
 const d=s.map(([x,y])=>skadiVertex(x,y,t,props.action).map(v=>v*512)),src=s.map(p=>p.map(v=>v*512))
 triangle(ctx,figure,[src[0],src[1],src[2]],[d[0],d[1],d[2]]);triangle(ctx,figure,[src[0],src[2],src[3]],[d[0],d[2],d[3]])
 }
}
const media=matchMedia('(prefers-reduced-motion: reduce)')
function tick(ms:number){if(disposed)return;if(ms-last>=33){paint(ms);last=ms}raf=requestAnimationFrame(tick)}
function restart(){cancelAnimationFrame(raf);paint(performance.now());if(!props.paused&&!props.gentle&&!document.hidden&&!media.matches)raf=requestAnimationFrame(tick)}
async function load(){const current=++version;failed.value=false;ready.value=false;try{const src=props.src;let image=imageCache.get(src);if(!image){image=new Image();image.src=src;await image.decode();imageCache.set(src,image)}if(props.showWeapon&&!weaponArt.length){weaponArt=await Promise.all((await loadSkadiWeapons()).map(async src=>{const i=new Image();i.src=src;await i.decode();return i}))}if(disposed||current!==version)return;artwork=image;ready.value=true;restart()}catch{if(!disposed&&current===version)failed.value=true}}
watch(()=>[props.src,props.weapon,props.showWeapon],()=>void load());watch(()=>[props.action,props.paused,props.gentle],restart)
onMounted(()=>{void load();document.addEventListener('visibilitychange',restart);media.addEventListener('change',restart)})
onUnmounted(()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',restart);media.removeEventListener('change',restart);imageCache.clear()})
</script>
<template><img v-if="failed" :src="src" alt="" class="skadi-figure"/><canvas v-show="!failed" ref="canvas" :data-ready="ready" :data-held-pieces="showWeapon?(weapon==='twins'?2:1):0" width="512" height="512" class="skadi-figure" aria-hidden="true"></canvas><span v-if="failed" class="skadi-weapon-load">兵装暂未加载，请切换场景重试。</span></template>
