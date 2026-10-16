import { loadDinosaurTransformation, createDinosaurTransformationRenderer } from '../../src/dinosaur/transformation'
import { loadAwakenedArt, energyFrame } from '../../src/evolution/atlas'
import { loadDinosaur } from '../../src/dinosaur/sprites'
import { dinosaurFrame } from '../../src/dinosaur/play'
import { tintDinosaurPixels } from '../../src/dinosaur/skins'
import type { DinosaurSkin } from '../../src/shared/types'
const canvas=document.querySelector<HTMLCanvasElement>('#canvas')!,ctx=canvas.getContext('2d')!
const skin=document.querySelector<HTMLSelectElement>('#skin')!,quota=document.querySelector<HTMLSelectElement>('#quota')!,timeline=document.querySelector<HTMLInputElement>('#timeline')!,label=document.querySelector<HTMLElement>('#beat')!
let draw:ReturnType<typeof createDinosaurTransformationRenderer>,original:HTMLCanvasElement,target:HTMLCanvasElement,raf=0,revision=0
const names={gather:'低头蓄能',grow:'装备生长',reveal:'抬头 · 张臂展示',settle:'光效收束'}
function paint(ms:number,duration=1600,reverse=false){const time=draw(ctx,ms,duration,original,target,reverse);label.textContent=names[time.beat];timeline.value=String(time.t*1600);canvas.dataset.beat=time.beat;return time}
async function load(){
 cancelAnimationFrame(raf);const ticket=++revision;label.textContent='动作准备中…'
 try{
  const selected=skin.value as DinosaurSkin,percent=Number(quota.value)
  const [poses,awake,base]=await Promise.all([loadDinosaurTransformation(selected),loadAwakenedArt('dinosaur',selected),loadDinosaur()])
  if(ticket!==revision)return
  original=document.createElement('canvas');original.width=original.height=512;const c=original.getContext('2d')!;c.drawImage(base[dinosaurFrame(percent,'idle')]!,0,0)
  const pixels=c.getImageData(0,0,512,512);tintDinosaurPixels(pixels.data,selected);c.putImageData(pixels,0,0)
  target=awake.frames[energyFrame(percent,5)]!;draw=createDinosaurTransformationRenderer(poses,selected);paint(0);canvas.dataset.ready='true'
 }catch{label.textContent='素材加载失败，请重新选择皮肤'}
}
function play(reverse=false){if(!draw)return;cancelAnimationFrame(raf);const start=performance.now(),duration=reverse?600:1600
 function tick(now:number){if(!paint(now-start,duration,reverse).done)raf=requestAnimationFrame(tick)}raf=requestAnimationFrame(tick)
}
skin.onchange=load;quota.onchange=load;timeline.oninput=()=>{cancelAnimationFrame(raf);if(draw)paint(Number(timeline.value))}
document.querySelector<HTMLButtonElement>('#play')!.onclick=()=>play()
document.querySelector<HTMLButtonElement>('#reverse')!.onclick=()=>play(true)
void load()
