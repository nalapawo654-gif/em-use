import type { CultivationRealm } from '../shared/types'
import type { Practice } from './training'
import type { Encounter } from './encounters'

export interface CranePose { x:number; y:number; tilt:number; wing:number; facing:number }
export interface Ambience { clock:number; flightTime:number; crane:CranePose }
export interface AmbienceOptions { paused:boolean; reduced:boolean; active:boolean; realm:CultivationRealm; practice:Practice; encounter:Encounter|null }
const home:CranePose={x:0,y:0,tilt:0,wing:0,facing:0}
export const createAmbience=():Ambience=>({clock:0,flightTime:0,crane:{...home}})
const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t)}
export function craneCanFly(options:AmbienceOptions) {
  return !options.active && !options.encounter && !['rain','thunder','tribulation'].includes(options.realm) && options.practice!=='sword'
}
// Stay to the right on ascent/descent; the crossing is above the face and quota.
export function craneFlight(time:number):CranePose {
  const t=(time%32000)/1000
  if(t<7 || t>=24)return {...home,wing:Math.sin(time/1700)*2}
  let x=0,y=0,facing=180,tilt=-28
  if(t<10){const p=ease((t-7)/3);x=-3*p;y=-36*p}
  else if(t<15){const p=ease((t-10)/5);x=-3-46*p;y=-36-2*Math.sin(p*Math.PI)}
  else if(t<21){const p=ease((t-15)/6);x=-49+46*p;y=-36-2*Math.sin(p*Math.PI);facing=0;tilt=28}
  else {const p=ease((t-21)/3);x=-3*(1-p);y=-36*(1-p);facing=0;tilt=28*(1-p)}
  return {x,y,tilt,wing:Math.sin(time/150)*19,facing}
}
export function advanceAmbience(state:Ambience,delta:number,options:AmbienceOptions):Ambience {
  if(options.paused || !Number.isFinite(delta) || delta<=0)return state
  if(options.reduced)return {...state,flightTime:0,crane:{...home}}
  const dt=Math.min(delta,100),clock=state.clock+dt,flightTime=craneCanFly(options)?state.flightTime+dt:0
  let target=craneCanFly(options)?craneFlight(flightTime):{...home,wing:Math.sin(clock/1700)*2}
  if(!options.active && options.encounter?.kind==='spirit-visit'){
    const t=options.encounter.elapsed/11000,p=t<.45?ease(t/.45):1-ease((t-.65)/.35)
    target={...home,x:-15*p,tilt:-10*p,wing:Math.sin(clock/220)*2}
  }
  // Return via the upper-right sky, rather than cutting diagonally through the face.
  if(!craneCanFly(options) && state.crane.y < -3 && state.crane.x < -4){
    target={x:0,y:Math.min(-32,state.crane.y),tilt:28,wing:Math.sin(clock/150)*19,facing:0}
  }
  // Shared easing also lands a flying crane before a dangerous event takes over.
  const mix=1-Math.exp(-dt/170),crane={...state.crane}
  for(const key of Object.keys(home) as (keyof CranePose)[])crane[key]+=(target[key]-crane[key])*mix
  return {clock,flightTime,crane}
}
export function showIncense(practice:Practice,active:boolean) { return practice!=='alchemy' || active }
