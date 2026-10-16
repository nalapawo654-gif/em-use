import { TRANSFORMATION_ATLASES,loadTransformation,createTransformationRenderer,transformationEndFrame } from '../../src/evolution/transformation'
import { loadAwakenedArt,energyFrame } from '../../src/evolution/atlas'
import type { Scene } from '../../src/shared/types'
const select=document.querySelector<HTMLSelectElement>('#skin')!,quota=document.querySelector<HTMLSelectElement>('#quota')!,canvas=document.querySelector<HTMLCanvasElement>('#canvas')!,slider=document.querySelector<HTMLInputElement>('#timeline')!,beat=document.querySelector<HTMLElement>('#beat')!
const params=new URLSearchParams(location.search),filter=params.get('scene'),gallery=params.has('gallery')
const entries=Object.entries(TRANSFORMATION_ATLASES).filter(([key])=>!filter||key.startsWith(filter+'/'))
for(const [key,spec]of entries){const o=document.createElement('option');o.value=key;o.textContent=spec.name+' · '+key;select.append(o)}
let draw:ReturnType<typeof createTransformationRenderer>,target:HTMLCanvasElement,raf=0,version=0
function paint(ms:number,duration=1600,reverse=false){const result=draw(canvas.getContext('2d')!,ms,duration,target,reverse);slider.value=String(result.t*1600);beat.textContent=({gather:'蓄能',grow:'装备成形',reveal:'展示',settle:'收束'})[result.beat]!;return result}
async function load(){cancelAnimationFrame(raf);const ticket=++version;canvas.dataset.ready='false';const [scene,skin,form]=select.value.split('/');try{
 const [poses,art]=await Promise.all([loadTransformation(scene as Scene,skin!,form),loadAwakenedArt(scene as Scene,skin!,form)]);if(ticket!==version)return
 draw=createTransformationRenderer(scene as Scene,skin!,poses);target=art.frames[transformationEndFrame(scene as Scene,Number(quota.value),art.frames.length)]!;paint(0);canvas.dataset.ready='true'
 const container=document.querySelector('#poses')!;container.replaceChildren();for(const p of poses){const img=new Image();img.src=p.toDataURL();container.append(img)}
}catch(e){beat.textContent=String(e)}}
function play(reverse=false){if(!draw)return;cancelAnimationFrame(raf);const start=performance.now(),duration=reverse?600:1600;function tick(now:number){if(!paint(now-start,duration,reverse).done)raf=requestAnimationFrame(tick)}raf=requestAnimationFrame(tick)}
select.onchange=load;quota.onchange=load;slider.oninput=()=>{cancelAnimationFrame(raf);if(draw)paint(Number(slider.value))};document.querySelector<HTMLButtonElement>('#play')!.onclick=()=>play();document.querySelector<HTMLButtonElement>('#reverse')!.onclick=()=>play(true)
if(gallery){document.body.classList.add('gallery');let count=0;const container=document.querySelector('#gallery')!;for(const [key,spec]of entries){const [scene,skin,form]=key.split('/'),h=document.createElement('h2'),row=document.createElement('div');h.textContent=spec.name+' · '+key;row.className='gallery-row';row.dataset.key=key;container.append(h,row);try{const poses=await loadTransformation(scene as Scene,skin!,form);row.append(...poses);count+=poses.length}catch(e){row.dataset.error=String(e)}}document.querySelector('#summary')!.textContent=`${entries.length} 套形态 · ${count} 张动作帧`;document.body.dataset.ready='true'}else void load()
