import { buddyRig } from '../../src/buddy/sprites'
import { renderBuddy } from '../../src/buddy/render'
import { sampleBuddyMotion } from '../../src/buddy/motion'
import { ACTION_LABELS, type BuddyAction } from '../../src/buddy/play'
import { BUDDY_SKINS } from '../../src/shared/types'
const action = document.querySelector<HTMLSelectElement>('#action')!
for (const [value,label] of Object.entries(ACTION_LABELS)) action.add(new Option(label || '自然待机',value))
const time=document.querySelector<HTMLInputElement>('#time')!, level=document.querySelector<HTMLSelectElement>('#level')!
const actors=await Promise.all(BUDDY_SKINS.map(async item=>{
  const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption')
  canvas.width=canvas.height=512;caption.textContent=item.label;figure.append(canvas,caption);document.querySelector('main')!.append(figure)
  return {canvas,skin:item.id,rig:await buddyRig(item.id)}
}))
function draw(){const at=Number(time.value),air=Number(level.value),mode=action.value as BuddyAction,m=sampleBuddyMotion(mode,at,at,air);for(const a of actors)renderBuddy(a.canvas.getContext('2d')!,a.rig,a.skin,mode,at,m,air);document.querySelector('output')!.textContent=`${m.phase} · ${m.expression}`}
for(const input of [action,time,level])input.addEventListener('input',draw)
draw()
