import type { HamsterAction } from './play'
export type CatMood = 'watch' | 'yawn' | 'sleep' | 'snack' | 'caught'
export const CAT_LABELS:Record<CatMood,string>={watch:'监工中…',yawn:'困了喵…',sleep:'偷偷补觉',snack:'就吃一颗',caught:'没偷吃喵'}
export function catPose(elapsed:number,action:HamsterAction,since:number,now:number,night:boolean,reduced:boolean):{mood:CatMood;frame:number}{
  const age=Math.max(0,now-since)
  let mood:CatMood='watch', t=0
  if(action==='cat-yawn'){mood='yawn';t=age}
  else if(action==='cat-nap'||action==='sleep'){mood=!reduced&&age<2000?'yawn':'sleep';t=age<2000?age:age-2000}
  else if(action==='cat-snack'||action==='feed'){mood='snack';t=age}
  else if(action==='bell'||action==='tease'){mood='caught';t=age}
  else if(!reduced){
    const cycle=Math.max(0,elapsed)%42000
    if(cycle>=6000&&cycle<8600){mood='yawn';t=cycle-6000}
    else if(cycle>=8600&&cycle<(night?26000:17600)){mood='sleep';t=cycle-8600}
    else if(cycle>=28000&&cycle<32800){mood='snack';t=cycle-28000}
  }
  if(mood==='watch')return{mood,frame:0}
  if(mood==='caught')return{mood,frame:11}
  if(mood==='yawn')return{mood,frame:reduced?2:[0,1,2,2,3,3][Math.min(5,Math.floor(t/430))]}
  if(mood==='sleep')return{mood,frame:reduced?5:4+Math.floor(t/900)%4}
  return{mood,frame:reduced?9:[8,9,10,9,10,11][Math.min(5,Math.floor(t/700))]}
}
export function renderCat(ctx:CanvasRenderingContext2D,frames:HTMLCanvasElement[],frame:number,mood:CatMood,time:number,motion:boolean){
  ctx.clearRect(0,0,384,341)
  const breathe=motion&&mood==='sleep'?Math.sin(time/800)*.8:0
  // The cat's face and paws animate; the cardboard base remains stationary.
  ctx.drawImage(frames[frame],0,0,384,256,0,breathe,384,256)
  ctx.drawImage(frames[0],0,256,384,85,0,256,384,85)
}
