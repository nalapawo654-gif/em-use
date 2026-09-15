// Development-only harness for the actual BuddyExperience, never included in the production entry.
import { BUDDY_SKINS, type Settings } from '../../src/shared/types'
import { ACTION_LABELS, type BuddyAction } from '../../src/buddy/play'
import { buddyRig } from '../../src/buddy/sprites'
import { renderBuddy } from '../../src/buddy/render'
import { sampleBuddyMotion } from '../../src/buddy/motion'
const api=window.emUse!
const root=document.createElement('aside');root.setAttribute('aria-label','日历验证控制');Object.assign(root.style,{position:'fixed',top:'530px',left:'12px',width:'820px',background:'#f7f9fb',color:'#244564',padding:'14px',font:'13px sans-serif',zIndex:'2000',borderRadius:'10px'});document.body.append(root)
const forceStyle=document.createElement('style');forceStyle.textContent='.calendar-layout-check .buddy-widget :is(.buddy-header,.buddy-tools,.buddy-status,.buddy-resize){opacity:1!important;visibility:visible!important;pointer-events:auto!important}';document.head.append(forceStyle);
const output=document.createElement('pre');output.style.cssText='white-space:pre-wrap;max-height:180px;overflow:auto';output.setAttribute('aria-live','polite')
const title=document.createElement('strong');title.textContent='开发验证 · 演示日程，不连接真实账户';root.append(title,document.createElement('br'))
const scene=()=>document.querySelector('.buddy-scene') as HTMLElement & {__vueParentComponent:{exposed:{act:(action:BuddyAction)=>void;cancel:()=>void}}}
function select(label:string,options:[string,string][],change:(value:string)=>void){const el=document.createElement('select');el.ariaLabel=label;el.style.margin='8px';for(const [value,text]of options)el.add(new Option(text,value));el.addEventListener('change',()=>change(el.value));root.append(el);return el}
select('验证尺寸',[['440','标准 440'],['300','紧凑 300'],['190','迷你 190'],['180','最小 180']],v=>{void api.settings({windowWidth:Number(v)})})
select('验证皮肤',BUDDY_SKINS.map(s=>[s.id,s.label]),v=>{void api.settings({buddySkin:v as Settings['buddySkin']})})
select('验证额度',[['68','正常 68%'],['100','100%'],['50','50%'],['20','20%'],['15','15%'],['0','0%'],['unknown','未知']],v=>(window as unknown as {__setQuota:(n:number|null)=>void}).__setQuota(v==='unknown'?null:Number(v)))
select('验证动作',Object.entries(ACTION_LABELS).map(([id,label])=>[id,label||'自然待机']),v=>scene().__vueParentComponent.exposed.act(v as BuddyAction))
select('验证昼夜',[['day','白天'],['night','夜晚']],v=>{void api.settings({theme:v as 'day'|'night'})})
select('验证动效',[['true','轻柔'],['false','动画']],v=>{void api.settings({reducedMotion:v==='true'})})
const errors:string[]=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)))
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))
const nextFrame=()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())))
function button(label:string,fn:()=>Promise<void>){const b=document.createElement('button');b.textContent=label;b.style.cssText='border:1px solid #bacdde;padding:8px;margin:6px;border-radius:6px';b.onclick=()=>void fn();root.append(b)}
function rect(el:Element){return el.getBoundingClientRect()}
function overlap(a:DOMRect,b:DOMRect){return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1}
button('运行布局与动作组合检查',async()=>{
 document.body.classList.add('calendar-layout-check');output.textContent='检查中…';const findings:unknown[]=[];let layouts=0,motions=0;let maxOverlap=0
 try{
  const prop=document.querySelector<HTMLCanvasElement>('.buddy-calendar-art canvas')!;if(!prop.width)throw Error('日历物料未加载')
  const original=document.createElement('canvas');original.width=original.height=512;const ctx=original.getContext('2d')!
  for(const skin of BUDDY_SKINS){const rig=await buddyRig(skin.id)
   for(const level of [0,1,2,3])for(const action of Object.keys(ACTION_LABELS) as BuddyAction[])for(const time of [0,400,1200,2500,5000]){
    renderBuddy(ctx,rig,skin.id,action,time,sampleBuddyMotion(action,time,time,level),level)
    // All animated anatomy and prop pixels are clipped to the existing actor canvas.
    const b=rect(document.querySelector('.buddy-actor')!),c=rect(document.querySelector('.buddy-calendar-launcher')!);if(overlap(b,c))maxOverlap++
    motions++
   }
  }
  for(const width of [440,300,190,180])for(const skin of BUDDY_SKINS)for(const theme of ['day','night'] as const)for(const percent of [100,50,20,15]){
   await api.settings({windowWidth:width,buddySkin:skin.id,theme,reducedMotion:true});(window as unknown as {__setQuota:(n:number)=>void}).__setQuota(percent);scene().__vueParentComponent.exposed.cancel();await nextFrame()
   const calendar=document.querySelector('.buddy-calendar-launcher')!,b=rect(calendar),host=rect(document.querySelector('.buddy-widget')!);
   const colliders=[...document.querySelectorAll('.buddy-sign-copy,.buddy-actor,.message-launcher,.buddy-tools button,.buddy-header button,.buddy-motto,.buddy-status,.buddy-resize')].filter(e=>(e as HTMLElement).checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&overlap(b,rect(e)))
   const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('.buddy-calendar-launcher')===calendar
   if(colliders.length||!hit||b.left<host.left||b.bottom>host.bottom)findings.push({width,skin:skin.id,theme,percent,hit,colliders:colliders.map(e=>e.className)})
   layouts++;if(layouts%20===0)output.textContent=`检查中…布局 ${layouts}/160，动作采样 ${motions}`
  }
  await api.settings({windowWidth:440,buddySkin:'classic',theme:'day',reducedMotion:true});(window as unknown as {__setQuota:(n:number)=>void}).__setQuota(68);scene().__vueParentComponent.exposed.cancel();await nextFrame()
  document.body.classList.remove('calendar-layout-check');
  const result={layouts,motions,actorCanvasOverlaps:maxOverlap,findings,errors,passed:!findings.length&&!maxOverlap&&!errors.length};output.textContent=JSON.stringify(result,null,2);document.body.dataset.calendarQa=JSON.stringify(result)
 }catch(e){output.textContent=String(e)}
})
button('检查清洁中打开日历',async()=>{
 scene().__vueParentComponent.exposed.act('clean');await nextFrame();document.querySelector<HTMLButtonElement>('.buddy-calendar-launcher')!.click();await sleep(300);
 const result={action:scene().dataset.action,calendarRequested:!!document.querySelector('iframe[title="今日日程"]'),gesture:document.body.dataset.gesture};output.textContent=JSON.stringify(result,null,2)
})
button('隐藏验证控制',async()=>{root.style.display='none'})
root.append(output)
