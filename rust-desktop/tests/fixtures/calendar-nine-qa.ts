import * as types from '../../src/shared/types'
import { CALENDAR_PROPS } from '../../src/shared/calendarProps'
const scenes=Object.keys(CALENDAR_PROPS) as (keyof typeof CALENDAR_PROPS)[]
const f=document.querySelector<HTMLIFrameElement>('#subject')!,output=document.querySelector<HTMLPreElement>('#output')!,select=document.querySelector<HTMLSelectElement>('#scene')!
for(const scene of scenes)select.add(new Option(types.SCENE_LABELS[scene],scene))
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))
const doc=()=>f.contentDocument!,api=()=>f.contentWindow!.emUse!
const visible=(e:Element)=>(e as HTMLElement).checkVisibility({checkOpacity:true,checkVisibilityCSS:true})
const errors:string[]=[]
async function load(scene:string){await new Promise<void>(resolve=>{f.onload=()=>resolve();f.src=`desktop.html?scene=${scene}&width=440&canvas=1&calendar=1&messages=1&motion=off`});for(let n=0;n<600;n++){await frame();if(doc()?.querySelector('.scene-calendar-art[data-ready="true"]'))break;if(n===599)throw Error(`${scene}: asset not ready`)};f.contentWindow!.addEventListener('error',e=>errors.push(e.message));f.contentWindow!.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));const style=doc().createElement('style');style.textContent=`.${scene}-widget :is(.${scene}-chrome,.${scene}-resize){opacity:1!important;visibility:visible!important;pointer-events:auto!important}`;doc().head.append(style)}
async function width(value:number){doc().documentElement.style.setProperty('--fixture-width',`${value}px`);await api().settings({windowWidth:value});await frame()}
function inspect(scene:string){const b=doc().querySelector<HTMLElement>('.pet-calendar-launcher')!,r=b.getBoundingClientRect();const bounds=doc().querySelector(`.${scene}-widget`)!.getBoundingClientRect();const overlap=(t:DOMRect)=>Math.min(r.right,t.right)-Math.max(r.left,t.left)>.5&&Math.min(r.bottom,t.bottom)-Math.max(r.top,t.top)>.5;const collisions=[...doc().querySelectorAll(`.scene-hit,[class*="quota"],.${scene}-header,.${scene}-tools button,.${scene}-footer,.${scene}-resize,.message-launcher`)].filter(e=>visible(e)&&overlap(e.getBoundingClientRect())).map(e=>e.className);return {collisions,hit:doc().elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.pet-calendar-launcher')===b,inside:r.x>=bounds.x&&r.right<=bounds.right+.5&&r.y>=bounds.y&&r.bottom<=bounds.bottom+.5}}
select.onchange=()=>void load(select.value)
document.querySelector<HTMLSelectElement>('#width')!.onchange=e=>void width(Number((e.target as HTMLSelectElement).value))
document.querySelector<HTMLButtonElement>('#run')!.onclick=async e=>{const button=e.target as HTMLButtonElement;button.disabled=true;const findings:unknown[]=[];let layouts=0,actions=0,panels=0,skins=0,motionFrames=0,reminders=0;try{
for(const scene of scenes){select.value=scene;await load(scene)
for(const size of [440,300,190,180])for(const theme of ['day','night'] as const)for(const percent of [100,50,20,15,0,null]){await width(size);await api().settings({theme});(f.contentWindow as unknown as {__setQuota:(v:number|null)=>void}).__setQuota(percent);await frame();const c=inspect(scene);if(c.collisions.length||!c.hit||!c.inside)findings.push({scene,size,theme,percent,...c});layouts++;output.textContent=`检查中 ${scene} · ${layouts}`}
await width(440);await api().settings({theme:'day'});(f.contentWindow as unknown as {__setQuota:(v:number|null)=>void}).__setQuota(68)
const skinList=types[`${scene.toUpperCase()}_SKINS` as keyof typeof types] as {id:string}[]
for(const skin of skinList){await api().settings({[`${scene}Skin`]:skin.id});await frame();const c=inspect(scene);if(c.collisions.length||!c.hit)findings.push({scene,skin:skin.id,...c});skins++}
const widget=doc().querySelector<HTMLElement>(`.${scene}-widget`)!
const escape=async()=>{widget.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await frame()}
const menu=()=>widget.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))
menu();await frame();const menuButtons=()=>[...doc().querySelectorAll<HTMLButtonElement>(`.${scene}-play-grid button,.${scene}-extra-grid button`)].filter(b=>!b.textContent?.includes("分享图"));const actionCount=menuButtons().length;await escape()
for(let i=0;i<actionCount;i++){menu();await frame();const b=menuButtons()[i];b.click();await frame();if(doc().querySelector('.pet-calendar')&&visible(doc().querySelector('.pet-calendar')!))findings.push({scene,action:b.ariaLabel||b.textContent,error:'calendar should yield during action'});actions++;await escape()}
await api().settings({reducedMotion:false});for(let i=0;i<100;i++){await frame();const c=inspect(scene);if(c.collisions.length||!c.hit)findings.push({scene,motionFrame:i,...c});motionFrames++}await api().settings({reducedMotion:true})
const launcher=doc().querySelector<HTMLButtonElement>('.pet-calendar-launcher')!;launcher.click();await frame();if(!doc().querySelector('iframe[title="今日日程"]'))findings.push({scene,error:'calendar panel did not open'});panels++
// Same native-facing API mock, only local fixture data; exercise masking and both responses.
await width(440)
const saved=await api().getState(),calendar=saved.calendar!;
for(const choice of ['ack','snooze'] as const){await api().settings({calendarPreview:choice==='ack'});(f.contentWindow as unknown as {__setCalendar:(c:types.CalendarState)=>void}).__setCalendar({...calendar,active:[calendar.items[0].key]});await api().calendarUi!(false);let toast:HTMLIFrameElement|null=null;for(let n=0;n<300;n++){await frame();toast=doc().querySelector('iframe[title="日程提醒"]');if(toast?.contentDocument?.querySelector('.calendar-reminder-actions button'))break};if(!toast)throw Error(scene+': reminder missing');const body=toast.contentDocument!.body;if(choice==='snooze'&&body.textContent?.includes('需求评审'))findings.push({scene,error:'masked reminder leaked title'});const response=[...body.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.includes(choice==='ack'?'知道了':'2 分钟后'));if(!response)throw Error(scene+': response missing');response.click();await frame();if(doc().body.dataset.calendarResponse!==choice+':'+calendar.items[0].key)findings.push({scene,choice,error:'response not propagated'});reminders++}
}
output.textContent=JSON.stringify({layouts,skins,actions,panels,motionFrames,reminders,findings,errors,passed:!findings.length&&!errors.length},null,2);document.body.dataset.result=output.textContent
}catch(err){output.textContent=select.value+": "+String(err)}finally{button.disabled=false}}
void load(scenes[0])
