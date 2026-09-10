import { beaverRig } from '../../src/beaver/sprites'
import { renderBeaver } from '../../src/beaver/render'
import { sampleBeaverMotion } from '../../src/beaver/motion'
import { BEAVER_HINTS, type BeaverAction } from '../../src/beaver/play'
import type { BeaverSkin } from '../../src/shared/types'
const action=document.querySelector<HTMLSelectElement>('#action')!,time=document.querySelector<HTMLInputElement>('#time')!,level=document.querySelector<HTMLSelectElement>('#level')!
for(const [value,label] of Object.entries(BEAVER_HINTS)) action.add(new Option(label||'持续啃树',value))
const actors=await Promise.all((['sunny','rain','snow','wind','night'] as BeaverSkin[]).map(async skin=>{
  const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption')
  canvas.width=640;canvas.height=512;caption.textContent=skin;figure.append(canvas,caption);document.querySelector('main')!.append(figure)
  return {canvas,skin,rig:await beaverRig(skin)}
}))
async function draw(){const at=Number(time.value),air=Number(level.value),mode=action.value as BeaverAction,m=sampleBeaverMotion(mode,at,at,air);for(const a of actors)renderBeaver(a.canvas.getContext('2d')!,a.rig,a.skin,mode,at,m);document.querySelector('output')!.textContent=`${m.phase} · ${at}ms`}
for(const input of [action,time,level])input.addEventListener('input',draw)
void draw()
