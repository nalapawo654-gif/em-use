import type { HamsterSkin } from '../shared/types'
import type { HamsterRig } from './sprites'
import { hamsterRunFrame } from './layout'
import type { HamsterAction, HamsterLevel } from './play'
export function hamsterFrame(level: HamsterLevel, action: HamsterAction) {
  if (action === 'sleep' || ((action === 'idle' || action.startsWith('cat-')) && level === 'empty')) return 5
  if (action === 'feed' || (action === 'idle' && level === 'unknown')) return 4
  if (action === 'wheel' || action === 'pet') return 1
  return level === 'low' ? 3 : level === 'working' ? 2 : 1
}
export function hamsterRunning(level:HamsterLevel,action:HamsterAction){
  return action==='wheel'||((action==='idle'||action.startsWith('cat-'))&&(level==='full'||level==='working'))
}
export function renderHamster(ctx:CanvasRenderingContext2D,rig:HamsterRig,level:HamsterLevel,action:HamsterAction,time:number,motion:boolean,skin:HamsterSkin='classic'){
  ctx.clearRect(0,0,512,512)
  const running=hamsterRunning(level,action), frame=hamsterFrame(level,action), resting=frame===3||frame===5
  ctx.drawImage(rig.base[7],65,354,382,130)
  ctx.save();ctx.translate(256,226)
  if(running&&motion)ctx.rotate(time/(action==='wheel'?1600:level==='working'?3000:2300))
  ctx.drawImage(rig.base[6],-201,-201,402,402);ctx.restore()
  if(resting){ctx.drawImage(rig.base[frame],45,174,380,380);return -1}
  const sequence=rig.skins[skin]
  if(!sequence)return -1
  const tired=level==='working'&&action!=='wheel', clock=action==='wheel'?time*1.25:time
  const step=action==='feed'?12+(motion?Math.floor(time/300)%2:0):hamsterRunFrame(clock,tired,!motion||!running)
  ctx.save()
  // Any secondary motion applies to the complete animal, including its clothes.
  if(action==='pet'&&motion){ctx.translate(256,375);ctx.rotate(Math.sin(time/190)*.018);ctx.translate(-256,-375)}
  const breathe=motion&&action==='feed'?Math.sin(time/120)*.7:0
  if(action==='feed')ctx.drawImage(sequence[step],139,-47+breathe,236,472)
  else ctx.drawImage(sequence[step],118,-122+breathe,276,552)
  ctx.restore();return step
}
