import { luckycatLevel, type LuckyCatAction, type LuckyCatLevel } from './play'
export type CatMotion = Exclude<LuckyCatAction, 'idle'>
export const CAT_DURATIONS: Record<CatMotion, number> = {fortune:4400, blink:1800, stretch:5400, coffee:5600, toss:6200, groom:4400, listen:3200, doze:5400, fish:4200, work:4600, box:4200, gift:4400}
export const clamp=(n:number)=>Math.max(0,Math.min(1,n))
export function ease(n:number){const p=clamp(n);return p*p*(3-2*p)}
export function envelope(p:number){return ease(p/.2)*ease((1-p)/.2)}
export function catMotionPool(level:LuckyCatLevel):CatMotion[]{
 if(level==='empty')return ['blink','doze','listen']
 if(level==='low')return ['blink','doze','listen','groom']
 if(level==='unknown')return ['blink','listen']
 if(level==='medium')return ['blink','coffee','stretch','work','groom','listen']
 return ['fortune','blink','stretch','coffee','toss','groom','listen','doze']
}
export function chooseCatMotion(percent:number|null,previous:CatMotion|null,random=Math.random):CatMotion{
 const pool=catMotionPool(luckycatLevel(percent)).filter(m=>m!==previous)
 return pool[Math.min(pool.length-1,Math.floor(clamp(random())*pool.length))]!
}
export function catMotionDelay(random=Math.random,first=false){return first?1800+clamp(random())*1200:5000+clamp(random())*7000}
export interface CatPose {left:number;right:number;leftLength:number;rightLength:number;headAngle:number;headY:number;stretch:number;closed:number;yawn:number;goldFlight:number;goldTurn:number;cup:number;prop:number}
export function catPose(motion:LuckyCatAction,p:number):CatPose{
 const e=envelope(p),pose:CatPose={left:-12,right:12,leftLength:112,rightLength:112,headAngle:0,headY:0,stretch:0,closed:0,yawn:0,goldFlight:0,goldTurn:0,cup:0,prop:0}
 if(motion==='fortune'||motion==='gift'){pose.left+=e*(158+Math.sin(p*Math.PI*8)*16);pose.headAngle=e*Math.sin(p*Math.PI*4)*3;pose.closed=e*.35;pose.prop=e}
 if(motion==='blink'){pose.closed=Math.max(ease((p-.12)/.07)*ease((.42-p)/.14),ease((p-.54)/.07)*ease((.88-p)/.17))}
 if(motion==='stretch'){pose.stretch=e;pose.headY=-e*27;pose.left=e*163+(1-e)*-12;pose.right=-e*163+(1-e)*12;pose.yawn=ease((p-.22)/.15)*ease((.82-p)/.2);pose.closed=e}
 if(motion==='coffee'){const lift=ease((p-.1)/.26)*ease((.94-p)/.24);pose.right+=lift*53;pose.rightLength-=lift*34;pose.headAngle=lift*5;pose.headY=lift*6;pose.closed=lift*.95;pose.cup=e}
 if(motion==='toss'){
  const t=clamp((p-.12)/.76)*2,phase=t%1;
  pose.right=12-e*(135+Math.sin(phase*Math.PI*2)*9);pose.headAngle=-e*7;pose.prop=e
  const flight=clamp((phase-.22)/.57);pose.goldFlight=(phase>=.22&&phase<=.79)?Math.sin(flight*Math.PI):0;pose.goldTurn=flight*360
 }
 if(motion==='groom'){pose.left+=e*(190+Math.sin(p*Math.PI*10)*9);pose.leftLength-=e*18;pose.closed=e;pose.headAngle=e*-7}
 if(motion==='listen'){pose.headAngle=e*Math.sin(p*Math.PI*3)*10;pose.headY=-e*4}
 if(motion==='doze'||motion==='box'){pose.closed=e;pose.headAngle=e*7;pose.headY=e*11;pose.stretch=-e*.15}
 if(motion==='fish'){pose.left=-12-e*37;pose.right=12+e*37;pose.leftLength-=e*13;pose.rightLength-=e*13;pose.headY=e*Math.sin(p*Math.PI*8)*3;pose.closed=e*.9;pose.prop=e}
 if(motion==='work'){pose.left=-12-e*(25+Math.sin(p*Math.PI*26)*5);pose.right=12+e*(25-Math.sin(p*Math.PI*26)*5);pose.headAngle=e*Math.sin(p*Math.PI*6)*2;pose.prop=e}
 return pose
}
