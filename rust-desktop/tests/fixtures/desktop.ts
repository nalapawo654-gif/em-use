// Development-only visual fixture: exercise the same native renderer at its exact
// window dimensions while keeping Electron authentication and OS APIs out of scope.
import { DEFAULT_SETTINGS, HAMSTER_SKINS, SCENE_LABELS, type AppState, type Settings, type MessageState } from '../../src/shared/types'
const query = new URLSearchParams(location.search)
const size = (query.get('size') ?? 'standard') as Settings['size']
document.body.style.width = `${({ standard: 440, compact: 300, mini: 190 })[size]}px`
const state: AppState = { status: 'ready', quota: { limit: 300, used: 96, remaining: 204, percent: 68, exceeded: false, estimatedAt: '2026-09-09T18:00:00', serverAt: '2026-09-09T18:00:00', receivedAt: Date.now(), day: '2026-09-09' }, message: '仅用于组件测试 · 演示额度', syncing: false, persistentLogin: false, loginOpen: false, settings: { ...DEFAULT_SETTINGS, size, windowWidth: ({ standard: 440, compact: 300, mini: 190 })[size], theme: query.get('theme') === 'night' ? 'night' : 'day', outfit: 'sailor', scene: query.get('scene') === 'cultivation' ? 'cultivation' : query.get('scene') === 'hamster' ? 'hamster' : query.get('scene') === 'beaver' ? 'beaver' : query.get('scene') === 'buddy' ? 'buddy' : 'aquarium', reducedMotion: query.get('motion') === 'off' }, version: '0.3.0-visual-test' }
const customWidth = Number(query.get('width'))
if (customWidth >= 180 && customWidth <= 800) { state.settings.windowWidth = customWidth; document.body.style.width = `${customWidth}px` }
// A wide QA canvas represents the neighbouring native notification window, not a larger pet.
if(query.has('canvas')) {
 const style=document.createElement('style')
 style.textContent=['feidudu','fox','luckycat','dinosaur','skadi'].map(scene=>`.${scene}-native,.${scene}-native .${scene}-widget{width:var(--fixture-width)!important;height:var(--fixture-width)!important}`).join('')
 document.head.append(style);document.documentElement.style.setProperty('--fixture-width',`${state.settings.windowWidth}px`)
}
// Separate notification windows use their own viewport, not the pet fixture width.
if (['messages', 'message-toast'].includes(query.get('view') ?? '')) {
  document.body.style.width = '100%'; document.body.style.overflow = 'hidden'
}
const requestedScene = query.get('scene')
if (requestedScene && requestedScene in SCENE_LABELS) state.settings.scene = requestedScene as Settings['scene']
state.settings.cultivationRandom=query.get('random')==='on'
if(query.has('buddySkin')) state.settings.buddySkin=query.get('buddySkin') as Settings['buddySkin']
if(query.has('cultivationSkin')) state.settings.cultivationSkin=query.get('cultivationSkin') as Settings['cultivationSkin']
if(query.has('accessory')) state.settings.cultivationAccessory=query.get('accessory') as Settings['cultivationAccessory']
if(query.has('treasure')) state.settings.cultivationTreasure=query.get('treasure') as Settings['cultivationTreasure']
const realm = query.get('realm')
if (realm && ['sunny','rain','night','thunder','tribulation','enlightened'].includes(realm)) state.settings.cultivationRealm = realm as Settings['cultivationRealm']
const skin = HAMSTER_SKINS.find(s => s.id === query.get('skin'))
if (skin) state.settings.hamsterSkin = skin.id
const listeners = new Set<(s: AppState) => void>()
if (query.get('quota') === 'none') { state.quota = null; state.status = 'signed-out'; state.message = '演示未连接状态' }
if (state.quota && query.has('percent')) {
  const percent = Number(query.get('percent'))
  if (Number.isFinite(percent) && percent >= 0 && percent <= 100) { state.quota.percent = percent; state.quota.remaining = 3 * percent; state.quota.used = 300 - state.quota.remaining; state.quota.exceeded = percent === 0 }
}
const status = query.get('status')
if (status && ['ready','stale','expired','resetting','unavailable','forbidden','signed-out','connecting'].includes(status)) { state.status = status as AppState['status']; state.message = '状态契约组件测试 · ' + status }
function snapshot() {
  const copy = structuredClone(state)
  if (copy.messages && !copy.settings.messagePreview) copy.messages.items.forEach(i => { i.body='你收到了一条新消息'; i.sender='咚咚'; i.title='新消息'; i.mentioned=false })
  return copy
}
const publish = () => listeners.forEach(fn => fn(snapshot()))
if(query.has('messages')) {
  state.loginMode='manual';state.account={id:'quota-B',name:'额度用户 B'}
  state.messages={epoch:'dong-A',status:'ready',message:'正在接收本机咚咚消息（演示）',account:{id:'dong-A',name:'咚咚用户 A'},revision:1,pausedUntil:0,newCount:1,items:[{key:'msg-1',conversation:'chat-1',sender:'张三',title:'张三',body:'接口已经更新，方便的时候帮忙看一下。',kind:'text',at:Date.now(),fresh:true,mentioned:false}]}
}
Object.assign(window,{__setQuota:(percent:number|null)=>{state.quota=percent===null?null:{...state.quota!,limit:300,used:300-3*percent,remaining:3*percent,percent,exceeded:percent===0};state.status=percent===null?'signed-out':'ready';publish()},__setMessages:(messages: MessageState)=>{state.messages=messages;publish()},__messageFixtureState:()=>structuredClone(state)})
// Explicit development fixture only. No network downloads or native installation.
const updateDemo = query.has('update')
if (updateDemo) {
  state.update = { status: 'available', version: '0.5.0', message: '发现演示新版本', notes: '新的陪伴小动作\n优化小尺寸显示与日常体验' }
  if (!query.has('fresh')) state.dismissedUpdateVersion = localStorage.getItem('em-use-fixture-update-dismissed') ?? ''
}
Object.assign(window, { __setUpdate: (patch: AppState['update']) => { state.update = patch; publish() } })
let messageToastFrame: HTMLIFrameElement | undefined
window.emUse = {
  async showMessageToast(epoch,key) {
    state.messageToast={epoch,key,side:'right'}
    if(!messageToastFrame){
      messageToastFrame=document.createElement('iframe');messageToastFrame.name='message-toast';messageToastFrame.title='咚咚新消息';
      messageToastFrame.src='/tests/fixtures/desktop.html?view=message-toast';
      Object.assign(messageToastFrame.style,{position:'fixed',border:'0',width:'284px',height:'96px',zIndex:'1000'})
      document.body.append(messageToastFrame)
    }
    Object.assign(messageToastFrame.style,{display:'block',left:`${state.settings.windowWidth+8}px`,top:`${state.settings.windowWidth*.12}px`});publish()
  },
  async hideMessageToast() {state.messageToast=null;if(messageToastFrame)messageToastFrame.style.display='none';publish()},
  async openMessagePanel() { document.body.dataset.messagePanelRequested='true'; window.open('/tests/fixtures/desktop.html?view=messages&messages=1&width=350', 'em-use-message-fixture', `width=350,height=${(state.messages?.items.length??0)<=1?240:360}`) },
  async openMessages() { document.body.dataset.messageDetailsRequested='true'; window.open('/tests/fixtures/desktop.html?view=settings&tab=messages&messages=1&width=800','_blank','width=880,height=680') },
  async openDongdong() { document.body.dataset.dongdongOpened=String(Number(document.body.dataset.dongdongOpened??0)+1) },
  async ackMessages(epoch,keys) { if(epoch!==state.messages?.epoch)throw Error('stale epoch');state.messages.items.forEach(i=>{if(keys.includes(i.key))i.fresh=false});state.messages.newCount=state.messages.items.filter(i=>i.fresh).length;publish() },
  async beginGesture(mode) { document.body.dataset.gesture = mode; return 1 }, async moveGesture() { document.body.dataset.gestureMoved = 'true' }, async endGesture() { document.body.dataset.gestureEnded = 'true' },
  async getState() { return snapshot() },
  async openUpdates() { document.body.dataset.updateDetailsRequested = 'true'; window.open('/tests/fixtures/desktop.html?view=settings&tab=updates&update=available&width=800', '_blank', 'width=880,height=680') },
  async dismissUpdate(version) { localStorage.setItem('em-use-fixture-update-dismissed', version); state.dismissedUpdateVersion = version; publish() },
  async checkUpdate() { document.body.dataset.updateChecks = String(Number(document.body.dataset.updateChecks ?? 0) + 1); state.update = { status: 'available', version: '0.5.0', message: '发现演示新版本' }; publish() },
  async installUpdate() { document.body.dataset.updateInstalls = String(Number(document.body.dataset.updateInstalls ?? 0) + 1); state.update = { status: 'downloading', version: state.update?.version, downloaded: 42, total: 100, message: '演示下载进度，不会安装或重启' }; publish() },
  async settings(patch) { Object.assign(state.settings, patch); if(state.messages) {state.messages.status=!state.settings.messageEnabled?'disabled':state.settings.messagePausedUntil>Date.now()?'paused':'ready';state.messages.pausedUntil=state.settings.messagePausedUntil} if (patch.size) state.settings.windowWidth = ({ standard: 440, compact: 300, mini: 190 })[patch.size]; document.body.style.width = `${state.settings.windowWidth}px`; publish() },
  onState(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  async login(mode='dongdong') {state.loginMode=mode;state.account={id:'quota-C',name:'额度用户 C'};publish()}, async logout() {state.loginMode='signed-out';state.account=null;state.quota=null;state.status='signed-out';publish()}, async refresh() {}, async hide() {}, async quit() {}, async openPortal() {}, async openReleases() {}, async screenshot() { return null },
  async openSettings() { window.dispatchEvent(new CustomEvent('open-settings')) },
}
if((query.get('view')==='messages' && window.opener?.emUse)||(query.get('view')==='message-toast' && window.parent!==window)) {
  const owner=(query.get('view')==='message-toast'?window.parent:window.opener) as Window
  const source=owner.emUse!
  window.emUse={...window.emUse,getState:()=>source.getState(),onState:fn=>source.onState(fn),ackMessages:(epoch,keys)=>source.ackMessages!(epoch,keys),openDongdong:()=>source.openDongdong!(),openMessagePanel:async()=>{await source.openMessagePanel!();await source.hideMessageToast!();owner.dispatchEvent(new CustomEvent('message-panel-opened'))},hide:async()=>{if(query.get('view')==='message-toast'){await source.hideMessageToast!();owner.dispatchEvent(new CustomEvent('message-toast-closed'))}else window.close()}}
  if(query.get('view')==='messages')window.addEventListener('pagehide',()=>owner.dispatchEvent(new CustomEvent('message-panel-closed')))
}
await import('../../src/main')
