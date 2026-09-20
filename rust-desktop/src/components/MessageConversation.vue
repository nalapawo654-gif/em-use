<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { api, appState as state } from '../bridge'
import type { ReadableMessage, MessagePart } from '../shared/types'
const props = defineProps<{ conversation: string; revision: string }>()
const rows = ref<ReadableMessage[]>([]), loading = ref(false), more = ref(false), error = ref('')
const root = ref<HTMLElement>(), viewer = ref<{url: string; name: string} | null>(null), zoom = ref(false)
const images = ref<Record<string, {url?:string; error?:string; loading?:boolean; ready?:boolean}>>({})
const statuses = ref<Record<string, 'sending'|'error'>>({})
let generation=0, disposed=false, pageBusy=false, refreshQueued=false, imageInFlight=0
let observer: IntersectionObserver | undefined
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const seen = new Set<string>(), posted = new Set<string>()
const fragments = (m: ReadableMessage): MessagePart[] => m.parts.flatMap(p => p.kind === 'text' ? (p.text.match(/[\s\S]{1,160}/gu) ?? ['']).map(text => ({...p,text})) : [p])
const stamp = (at: number) => new Date(at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})
const imageKey = (key:string,index:number) => `${key}:${index}`
function active() { return !disposed && !document.hidden && document.hasFocus() && state.settings.messagePreview && !viewer.value }
function clearTimers() { for(const timer of timers.values())clearTimeout(timer); timers.clear() }
async function load(older=false) {
  if(pageBusy){if(!older)refreshQueued=true;return}
  if(!api.messageHistory || !state.messages || !state.settings.messagePreview)return
  const turn=generation, epoch=state.messages.epoch, chat=props.conversation
  pageBusy=true; loading.value=true; error.value=''
  try {
    const result=await api.messageHistory(epoch,chat,older?rows.value.at(-1)?.key:undefined)
    if(turn!==generation || epoch!==state.messages?.epoch || result.epoch!==epoch)return
    const combined=older?[...rows.value,...result.items]:[...result.items,...rows.value.filter(m=>!result.items.some(r=>r.key===m.key))]
    rows.value=[...new Map(combined.map(m=>[m.key,m])).values()].slice(0,500)
    more.value=older?result.hasMore:(rows.value.length>result.items.length?more.value:result.hasMore)
    await observe()
  } catch(e) {if(turn===generation)error.value=typeof e==='string'?e:'消息加载失败，请重试。'}
  finally {if(turn===generation){pageBusy=false;loading.value=false;if(refreshQueued){refreshQueued=false;void load()}}}
}
async function loadImage(m:ReadableMessage,index:number,force=false) {
  const key=imageKey(m.key,index)
  if(!api.messageImage || !state.messages || images.value[key]?.loading || (!force&&images.value[key]?.url))return
  const turn=generation,epoch=state.messages.epoch
  if(imageInFlight>=2)return
  imageInFlight++;images.value[key]={loading:true}
  try {
    const result=await api.messageImage(epoch,m.key,index)
    if(turn!==generation || result.epoch!==state.messages?.epoch)return
    if(!/^data:image\/(png|jpeg|gif|webp);base64,/.test(result.url))throw Error('图片格式不支持')
    let used=Object.values(images.value).reduce((sum,item)=>sum+(item.url?.length??0),0)
    for(const old of Object.keys(images.value)){if(used+result.url.length<48*1024*1024)break;if(old===key)continue;used-=images.value[old]?.url?.length??0;delete images.value[old]}
    images.value[key]={url:result.url,ready:false}
  } catch(e) {if(turn===generation)images.value[key]={error:typeof e==='string'?e:'图片加载失败，请重试'}}
  finally{imageInFlight--;if(!disposed)void observe()}
}
function imageLoaded(m:ReadableMessage,index:number) {
  const entry=images.value[imageKey(m.key,index)];if(entry)entry.ready=true
  void observe()
}
async function markRead(m:ReadableMessage,retry=false) {
  if(!api.readMessages || !state.messages || !active() || m.own || !m.complete || m.withdrawn || m.readState==='synced' || (!retry && (posted.has(m.key)||m.readState==='server')))return
  const turn=generation,epoch=state.messages.epoch
  posted.add(m.key);statuses.value[m.key]='sending'
  try {
    const result=await api.readMessages(epoch,[m.key])
    if(turn!==generation || result.epoch!==state.messages?.epoch)return
    const next=result.states.find(r=>r.key===m.key);if(next)m.readState=next.state
    delete statuses.value[m.key]
  } catch {if(turn===generation){statuses.value[m.key]='error'}}
}
async function observe() {
  await nextTick();if(disposed)return
  observer?.disconnect();clearTimers()
  const scroll=root.value?.closest<HTMLElement>('.message-inbox-scroll')
  observer=new IntersectionObserver(entries=>{
    for(const entry of entries) {
      const el=entry.target as HTMLElement, id=el.dataset.fragment!, key=el.dataset.row!
      const row=rows.value.find(m=>m.key===key);if(!row)continue
      const image=el.dataset.image
      if(entry.isIntersecting && image!==undefined && !images.value[imageKey(key,Number(image))])void loadImage(row,Number(image))
      if(!entry.isIntersecting || entry.intersectionRatio<.8 || !active()) {if(timers.has(id)){clearTimeout(timers.get(id));timers.delete(id)}continue}
      if(row.own || !row.complete || row.withdrawn || row.readState!=='unread' || timers.has(id))continue
      if(image!==undefined && !images.value[imageKey(key,Number(image))]?.ready)continue
      timers.set(id,setTimeout(()=>{
        timers.delete(id);if(!active())return
        seen.add(id)
        if(fragments(row).every((part,i)=>(part.kind==='quote'||(part.kind==='text'&&!part.text.trim()))||seen.has(`${key}:${i}`)))void markRead(row)
      },1200))
    }
  },{root:scroll,threshold:[0,.8]})
  root.value?.querySelectorAll('[data-fragment]').forEach(el=>observer?.observe(el))
}
function showImage(url:string|undefined) {if(url){clearTimers();viewer.value={url,name:'消息图片'};zoom.value=false;nextTick(()=>root.value?.querySelector<HTMLButtonElement>('.reader-lightbox-close')?.focus())}}
function closeImage(){viewer.value=null;nextTick(()=>root.value?.querySelector<HTMLButtonElement>('.reader-image-open')?.focus());void observe()}
function keys(e:KeyboardEvent){if(!viewer.value)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeImage()}else if(e.key==='Tab'){const buttons=Array.from(root.value?.querySelectorAll<HTMLButtonElement>('.reader-lightbox button')??[]),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}}
function focusChanged(){if(!active())clearTimers();else void observe()}
watch([()=>props.conversation,()=>state.messages?.epoch,()=>state.settings.messagePreview],()=>{
  ++generation;pageBusy=false;refreshQueued=false;rows.value=[];images.value={};viewer.value=null;error.value='';statuses.value={};seen.clear();posted.clear();clearTimers();observer?.disconnect()
  if(state.settings.messagePreview)void load()
},{immediate:true})
watch(()=>props.revision,()=>{void load()})
let poll: ReturnType<typeof setInterval>|undefined
onMounted(()=>{document.addEventListener('visibilitychange',focusChanged);window.addEventListener('focus',focusChanged);window.addEventListener('blur',focusChanged);window.addEventListener('keydown',keys,true);poll=setInterval(()=>{if(active()&&rows.value.some(m=>m.readState==='server'))void load()},5000)})
onUnmounted(()=>{disposed=true;++generation;clearTimers();observer?.disconnect();clearInterval(poll);document.removeEventListener('visibilitychange',focusChanged);window.removeEventListener('focus',focusChanged);window.removeEventListener('blur',focusChanged);window.removeEventListener('keydown',keys,true)})
</script>
<template>
  <div ref="root" class="message-reader">
    <p class="reader-note">正文停留阅读后同步已读 · 图片加载失败不会标读</p>
    <p v-if="error" class="reader-error" role="alert">{{error}} <button @click="load()">重试</button></p>
    <p v-if="loading&&!rows.length" class="reader-empty" role="status">正在展开消息…</p>
    <p v-else-if="!rows.length&&!error" class="reader-empty">暂无可显示的本机记录</p>
    <article v-for="message in rows" :key="message.key" class="reader-message" :class="{own:message.own}">
      <div class="reader-meta"><b>{{message.own?'我':message.sender}}</b><time>{{stamp(message.at)}}</time></div>
      <div class="reader-content"><template v-for="(part,i) in fragments(message)" :key="i">
        <span v-if="part.kind==='text'" class="reader-text" :data-row="message.key" :data-fragment="part.text.trim()?`${message.key}:${i}`:undefined">{{part.text}}</span>
        <div v-else-if="part.kind==='image'&&part.image!==null" class="reader-image" :data-row="message.key" :data-image="part.image" :data-fragment="`${message.key}:${i}`">
          <button v-if="images[imageKey(message.key,part.image)]?.url" class="reader-image-open" aria-label="放大消息图片" @click="showImage(images[imageKey(message.key,part.image)]?.url)"><img :src="images[imageKey(message.key,part.image)]?.url" alt="消息图片" @load="imageLoaded(message,part.image!)" @error="images[imageKey(message.key,part.image!)]={error:'图片解码失败，请重试'}"/><span>点击放大</span></button>
          <div v-else class="reader-image-placeholder"><span>{{images[imageKey(message.key,part.image)]?.error || '正在加载图片…'}}</span><button v-if="images[imageKey(message.key,part.image)]?.error" @click="loadImage(message,part.image!,true)">重新加载</button></div>
        </div>
        <blockquote v-else-if="part.kind==='quote'" class="reader-quote"><small>引用摘要</small>{{part.text}}</blockquote>
        <p v-else class="reader-unsupported">{{part.text}}</p>
      </template></div>
      <div v-if="!message.own&&message.complete&&!message.withdrawn" class="reader-receipt" :class="{pending:message.readState==='server',failed:statuses[message.key]==='error'}">
        <span v-if="statuses[message.key]==='sending'">正在同步已读…</span>
        <template v-else-if="statuses[message.key]==='error'">已查看 · 已读同步失败 <button @click="markRead(message,true)">重试</button></template>
        <span v-else-if="message.readState==='synced'">咚咚已读</span>
        <span v-else-if="message.readState==='server'" title="服务端已确认，本机咚咚暂未更新已读状态">服务端已读 · 本机待同步</span>
        <span v-else>未读</span>
      </div>
    </article>
    <button v-if="more" class="reader-more" :disabled="loading||rows.length>=500" @click="load(true)">{{loading?'加载中…':rows.length>=500?'本次已加载 500 条':'查看更早消息'}}</button>
    <div v-if="viewer" class="reader-lightbox" role="dialog" aria-label="图片预览" aria-modal="true">
      <div class="reader-lightbox-bar"><span>图片预览</span><button @click="zoom=!zoom">{{zoom?'适合窗口':'放大'}}</button><button class="reader-lightbox-close" aria-label="关闭图片预览" @click="closeImage">×</button></div>
      <div class="reader-lightbox-canvas" :class="{zoom}"><img :src="viewer.url" :alt="viewer.name"/></div>
    </div>
  </div>
</template>
<style scoped>
.message-reader{font-size:12px;line-height:1.7}.reader-note{margin:0;padding:8px 14px;color:var(--msg-muted);font-size:10px;border-bottom:1px solid var(--msg-line)}.reader-message{padding:13px 15px;border-bottom:1px solid color-mix(in srgb,var(--msg-line) 55%,transparent)}.reader-meta{display:flex;align-items:center;gap:8px;color:var(--msg-muted);font-size:10px;margin-bottom:7px}.reader-meta b{color:var(--msg-ink);font-size:11px}.reader-meta time{margin-left:auto;white-space:nowrap}.reader-content{overflow-wrap:anywhere;white-space:pre-wrap}.reader-text{white-space:pre-wrap}.reader-message.own{background:color-mix(in srgb,var(--msg-color,#357f8e) 5%,var(--msg-paper))}.reader-message.own .reader-meta b{color:var(--msg-color,#357f8e)}.reader-image{margin:9px 0;max-width:100%;min-height:90px}.reader-image-open{display:block;position:relative;width:100%;max-width:280px;border:1px solid var(--msg-line);border-radius:9px;padding:0;background:color-mix(in srgb,var(--msg-line) 20%,var(--msg-paper));overflow:hidden;cursor:zoom-in}.reader-image-open img{display:block;max-width:100%;width:auto;max-height:180px;object-fit:contain;margin:auto}.reader-image-open span{position:absolute;right:5px;bottom:5px;padding:1px 5px;background:#172b32b5;border-radius:4px;color:#fff;font-size:9px}.reader-image-placeholder{min-height:110px;border:1px dashed var(--msg-line);border-radius:9px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;padding:10px;color:var(--msg-muted);background:color-mix(in srgb,var(--msg-line) 15%,transparent)}.reader-receipt{margin-top:8px;font-size:10px;color:var(--msg-muted)}.reader-receipt.pending{color:#957039}.reader-receipt.failed,.reader-error{color:#ad5141}.reader-quote{margin:0 0 8px;padding:6px 10px;border-left:2px solid var(--msg-line);background:color-mix(in srgb,var(--msg-line) 20%,transparent);font-size:11px;color:var(--msg-muted)}.reader-quote small{display:block;font-size:9px}.reader-unsupported{padding:8px 10px;background:color-mix(in srgb,var(--msg-line) 20%,transparent);border-radius:6px;color:var(--msg-muted)}.reader-empty,.reader-error{padding:12px 15px}.message-reader button{font:inherit;color:inherit;cursor:pointer}.reader-receipt button,.reader-error button,.reader-image-placeholder button{border:0;background:none;text-decoration:underline;text-underline-offset:3px}.reader-more{display:block;margin:12px auto;padding:6px 14px;border:1px solid var(--msg-line);border-radius:20px;background:transparent}.reader-lightbox{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;background:var(--msg-paper);border-radius:14px;overflow:hidden}.reader-lightbox-bar{display:flex;gap:12px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--msg-line)}.reader-lightbox-bar>span{margin-right:auto}.reader-lightbox-bar button{border:0;background:transparent;padding:4px 8px}.reader-lightbox-close{font-size:22px!important}.reader-lightbox-canvas{min-height:0;flex:1;display:flex;align-items:center;justify-content:center;overflow:auto;padding:10px;background:color-mix(in srgb,var(--msg-line) 20%,transparent)}.reader-lightbox-canvas img{max-width:100%;max-height:100%;object-fit:contain}.reader-lightbox-canvas.zoom{display:block}.reader-lightbox-canvas.zoom img{max-width:none;max-height:none;width:200%}:focus-visible{outline:2px solid var(--msg-color,#357f8e);outline-offset:3px}
</style>
