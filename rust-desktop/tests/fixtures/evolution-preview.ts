// Development-only native bridge fixture. Never imports the real Tauri bridge.
import { DEFAULT_SETTINGS, type AppState, type DesktopAPI } from '../../src/shared/types'
const stamp = Date.now()
const state: AppState = {
  settings: {...DEFAULT_SETTINGS, scene:'potato', quotaSource:'codex', codexEnabled:true, calendarEnabled:false, messageEnabled:false, theme:'day'},
  status:'signed-out', quota:null, account:null, message:'演示数据', syncing:false, version:'QA',update:{status:'idle',message:''}, loginMode:'manual', persistentLogin:false, loginOpen:false,
  codex:{status:'ready',message:'演示数据 · 非真实账户',syncing:false,account:{id:'demo',name:'演示账户',plan:null},receivedAt:stamp,buckets:[{id:'codex',name:'Codex',plan:null,windows:[{id:'primary',remainingPercent:80,windowDurationMins:300,resetsAt:Math.floor(stamp/1000)+7200}]}]},
}
const listeners = new Set<(state: AppState) => void>()
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
