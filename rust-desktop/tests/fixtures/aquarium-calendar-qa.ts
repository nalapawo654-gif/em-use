// Development-only controls exercise the mounted Aquarium and shared calendar entry.
import { OUTFITS,type Settings } from '../../src/shared/types'
const api=window.emUse!
const root=document.createElement('aside');root.ariaLabel='鱼缸日历验证';root.style.cssText='position:fixed;top:530px;left:12px;width:820px;background:#eef7fa;color:#244564;padding:14px;font:13px sans-serif;z-index:2000;border-radius:10px';document.body.append(root)
const title=document.createElement('strong');title.textContent='鱼缸日历 · 开发验证 / 演示日程';root.append(title,document.createElement('br'))
const output=document.createElement('pre');output.style.cssText='white-space:pre-wrap;max-height:180px;overflow:auto';output.ariaLive='polite'
const style=document.createElement('style');style.textContent='.aquarium-calendar-check .widget :is(.widget-header,.widget-footer,.interaction-tools,.login-pill){opacity:1!important;visibility:visible!important;pointer-events:auto!important}.aquarium-calendar-check .widget:not(:has(.play-hud)) .resize-handle{opacity:1!important;visibility:visible!important;pointer-events:auto!important}';document.head.append(style)
const host=()=>document.querySelector('.aquarium') as HTMLElement&{__vueParentComponent:{exposed:Record<'cancel'|'feed'|'clean'|'hide'|'treasure',()=>void>}}
const action=(name:string)=>{const methods=host().__vueParentComponent.exposed;methods.cancel();if(name==='reveal'){methods.hide();methods.hide()}else if(name!=='idle')methods[name as 'feed'|'clean'|'hide'|'treasure']()}
function select(label:string,options:[string,string][],fn:(v:string)=>void){const s=document.createElement('select');s.ariaLabel=label;s.style.margin='8px';for(const [value,text] of options)s.add(new Option(text,value));s.onchange=()=>fn(s.value);root.append(s)}
const quota=(v:number|null)=>(window as unknown as {__setQuota:(n:number|null)=>void}).__setQuota(v)
select('鱼缸尺寸',[['440','440'],['300','300'],['190','190'],['180','180']],v=>{void api.settings({windowWidth:Number(v)})})
select('鱼缸装扮',OUTFITS.map(o=>[o.id,o.label]),v=>{void api.settings({outfit:v as Settings['outfit']})})
select('鱼缸水位',[['68','68%'],['100','100%'],['50','50%'],['20','20%'],['15','15%'],['0','0%'],['unknown','未知']],v=>quota(v==='unknown'?null:Number(v)))
select('鱼缸玩法',[['idle','游动'],['feed','喂食'],['clean','擦玻璃'],['hide','藏进洞穴'],['reveal','找到小鱼'],['treasure','宝箱珍珠']],action)
select('鱼缸昼夜',[['day','白天'],['night','夜晚']],v=>{void api.settings({theme:v as 'day'|'night'})})
select('鱼缸动效',[['true','轻柔'],['false','动画']],v=>{void api.settings({reducedMotion:v==='true'})})
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))
const errors:string[]=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)))
function button(text:string,fn:()=>Promise<void>){const b=document.createElement('button');b.textContent=text;b.style.cssText='padding:8px;margin:6px;border:1px solid #98bac4;border-radius:6px';b.onclick=()=>{b.disabled=true;void fn().catch(e=>output.textContent=String(e)).finally(()=>b.disabled=false)};root.append(b)}
function overlap(a:DOMRect,b:DOMRect){return Math.min(a.right,b.right)-Math.max(a.left,b.left)>0.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>0.5}
function inspect(){const button=document.querySelector('.aquarium-calendar-launcher')!,rect=button.getBoundingClientRect(),bounds=document.querySelector('.experience .widget')!.getBoundingClientRect();const colliders=[...document.querySelectorAll('.fish-hit,.treasure-hit,.cave-hit,.quota-overlay,.play-hud,.widget-header,.widget-footer,.interaction-tools button,.resize-handle,.message-launcher,.login-pill')].filter(e=>(e as HTMLElement).checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&overlap(rect,e.getBoundingClientRect())).map(e=>e.className);const hit=document.elementFromPoint(rect.x+rect.width*.4,rect.y+rect.height*.5)?.closest('.aquarium-calendar-launcher')===button;return {colliders,hit,inside:rect.x>=bounds.x&&rect.y>=bounds.y&&rect.right<=bounds.right&&rect.bottom<=bounds.bottom}}
button('运行鱼缸布局检查',async()=>{
 const saved=await api.getState();const findings:unknown[]=[];let layouts=0;document.body.classList.add('aquarium-calendar-check')
 try{if(document.querySelector('.aquarium-calendar-art')?.getAttribute('data-ready')!=='true')throw Error('日历素材尚未就绪')
 for(const width of [440,300,190,180])for(const outfit of OUTFITS)for(const theme of ['day','night'] as const)for(const percent of [100,50,20,15,0,null]){
  await api.settings({windowWidth:width,outfit:outfit.id,theme,reducedMotion:true});quota(percent)
  for(const mode of ['idle','feed','clean','hide','reveal','treasure']){action(mode);await frame();const check=inspect();if(check.colliders.length||!check.hit||!check.inside)findings.push({width,outfit:outfit.id,theme,percent,mode,...check});layouts++}
  output.textContent=`检查中 ${layouts}/1152`
 }
 output.textContent=JSON.stringify({layouts,findings,errors,passed:!findings.length&&!errors.length},null,2);document.body.dataset.aquariumCalendarQa=output.textContent
 }finally{action('idle');await api.settings(saved.settings);quota(saved.quota?.percent??null);document.body.classList.remove('aquarium-calendar-check')}
})
button('检查擦玻璃中开日历',async()=>{action('clean');await frame();document.querySelector<HTMLButtonElement>('.aquarium-calendar-launcher')!.click();await frame();output.textContent=JSON.stringify({mode:host().dataset.play,opened:!!document.querySelector('iframe[title="今日日程"]'),gesture:document.body.dataset.gesture},null,2)})
button('采样连续游动',async()=>{action('idle');await api.settings({reducedMotion:false});const findings:unknown[]=[];for(let i=0;i<150;i++){await frame();const c=inspect();if(c.colliders.length||!c.hit)findings.push(c)}output.textContent=JSON.stringify({frames:150,findings,errors,passed:!findings.length&&!errors.length},null,2)})
button('隐藏鱼缸验证',async()=>{root.style.display='none'})
root.append(output)
