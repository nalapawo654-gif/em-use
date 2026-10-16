// Development-only native bridge fixture. Never imports the real Tauri bridge.
import { DEFAULT_SETTINGS, SCENE_LABELS, FEIDUDU_SKINS, type AppState, type DesktopAPI, type Scene } from '../../src/shared/types'
const stamp = Date.now()
const state: AppState = {
  settings: {...DEFAULT_SETTINGS, scene:'potato', quotaSource:'codex', codexEnabled:true, calendarEnabled:false, messageEnabled:false, theme:'day'},
  status:'signed-out', quota:null, account:null, message:'演示数据', syncing:false, version:'QA',update:{status:'idle',message:''}, loginMode:'manual', persistentLogin:false, loginOpen:false,
  codex:{status:'ready',message:'演示数据 · 非真实账户',syncing:false,account:{id:'demo',name:'演示账户',plan:null},receivedAt:stamp,buckets:[{id:'codex',name:'Codex',plan:null,windows:[{id:'primary',remainingPercent:80,windowDurationMins:300,resetsAt:Math.floor(stamp/1000)+7200}]}]},
}
const listeners = new Set<(state: AppState) => void>()
const query = new URLSearchParams(location.search), scene = query.get('scene')
if (scene && scene in SCENE_LABELS) state.settings.scene = scene as Scene
const skin = FEIDUDU_SKINS.find(item => item.id === query.get('skin'))
if (skin) state.settings.feiduduSkin = skin.id
if (query.has('messages')) {
  state.settings.messageEnabled = true
  state.messages = {epoch:'demo',status:'ready',message:'演示消息',account:{id:'demo',name:'演示账户'},revision:1,pausedUntil:0,newCount:1,items:[{key:'demo-message',conversation:'demo',sender:'测试同事',title:'测试消息',body:'仅用于检查消息道具比例。',kind:'text',at:Date.now(),fresh:true,mentioned:false}]}
}
if (query.get('motion') === 'off') state.settings.reducedMotion = true
const emit = () => listeners.forEach(cb => cb(structuredClone(state)))
const noop = async () => {}
export const qa = {
  state,
  set(patch: Partial<AppState>) { Object.assign(state, patch); emit() },
  settings(patch: Partial<AppState['settings']>) { Object.assign(state.settings, patch); emit() },
  quota(percent: number) { state.codex!.receivedAt=Date.now();state.codex!.buckets[0]!.windows[0]!.remainingPercent=percent;emit() },
}
window.emUse = {
  getState:async()=>structuredClone(state),onState:cb=>{listeners.add(cb);return()=>listeners.delete(cb)},settings:async patch=>qa.settings(patch),
  refresh:noop,refreshCodex:noop,login:noop,logout:noop,openPortal:noop,openSettings:noop,beginGesture:async()=>1,moveGesture:noop,endGesture:noop,hide:noop,quit:noop,screenshot:async()=>null,openReleases:noop,
} as DesktopAPI
Object.assign(window, { __evolutionQa: qa })
await import('../../src/main')
