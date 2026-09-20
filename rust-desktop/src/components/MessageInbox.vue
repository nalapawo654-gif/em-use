<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { PhX, PhArrowUpRight, PhCaretLeft, PhCaretRight, PhChatCircleText, PhLockSimple } from '@phosphor-icons/vue'
import { api, appState as state } from '../bridge'
import type { MessageItem, RecentConversation } from '../shared/types'
import MessageConversation from './MessageConversation.vue'
import { messageGroups } from '../shared/messageNotice'
const props = defineProps<{ closeable?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const opening = ref(false), requested = ref(false), clearing = ref(false)
const selected = ref<string | null>(null), error = ref(''), area = ref<HTMLElement>(), close = ref<HTMLButtonElement>()
const recent = ref<RecentConversation[]>([])
let recentTurn=0, recentLoading=false
const recentBusy=ref(false)
const groups = computed(() => messageGroups(state.messages?.items ?? []))
const conversation = computed(() => selected.value)
const activeGroup = computed(() => groups.value.find(g => g.id === conversation.value) ?? (()=>{const c=recent.value.find(c=>c.key===conversation.value);return c?{id:c.key,title:c.title,items:[] as MessageItem[],fresh:0}:undefined})())
const recentList = computed(()=>[...recent.value, ...groups.value.filter(g=>!recent.value.some(c=>c.key===g.id)).map(g=>({key:g.id,title:g.title,body:g.items[0]?.body??'',at:g.items[0]?.at??0}))])
async function loadRecent(){
  const epoch=state.messages?.epoch
  if(!api.messageConversations || !epoch || !preview.value || recentLoading)return
  const turn=++recentTurn; recentLoading=true;recentBusy.value=true
  try {const result=await api.messageConversations(epoch);if(turn===recentTurn&&state.messages?.epoch===result.epoch)recent.value=result.items}
  catch(e){if(turn===recentTurn)error.value=typeof e==='string'?e:'最近会话加载失败，请重试。'}
  finally{if(turn===recentTurn){recentLoading=false;recentBusy.value=false}}
}
const items = computed(() => activeGroup.value?.items ?? [])
const preview = computed(() => state.settings.messagePreview)
const time = (at: number) => new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
let disposed = false
let observer: IntersectionObserver | undefined
const pending = new Set<string>()
async function observe() {
  await nextTick(); if(disposed)return; observer?.disconnect()
  const epoch = state.messages?.epoch
  observer = new IntersectionObserver(entries => {
    if(document.hidden || disposed || api.messageHistory)return
    const keys = entries.filter(e => e.isIntersecting && e.intersectionRatio >= .6).map(e => (e.target as HTMLElement).dataset.messageKey!).filter(k => !pending.has(k))
    if (!keys.length || !epoch || !api.ackMessages) return
    keys.forEach(k => pending.add(k))
    void api.ackMessages(epoch, keys).catch(() => { keys.forEach(k => pending.delete(k)); error.value = '提醒状态未保存，可稍后重试。' })
  }, { root: area.value, threshold: .6 })
  area.value?.querySelectorAll('[data-message-key]').forEach(e => observer?.observe(e))
}
watch(() => [conversation.value, state.messages?.epoch, items.value.map(i => i.key).join(',')], observe, { immediate: true, flush: 'post' })
watch(groups, value=>{
  if(!api.messageHistory&&selected.value&&!value.some(g=>g.id===selected.value))selected.value=null
  if(!api.messageConversations&&!selected.value&&value.length===1)selected.value=value[0].id
},{immediate:true})
watch([() => state.messages?.epoch, () => preview.value], () => { ++recentTurn;recentLoading=false;recentBusy.value=false; selected.value = null; recent.value=[];pending.clear();error.value='';void loadRecent() }, {flush:'sync',immediate:true})
watch(()=>state.messages?.revision,()=>{void loadRecent()})
nextTick(() => { if (props.closeable) close.value?.focus({ preventScroll: true }) })
onMounted(()=>document.addEventListener('visibilitychange',observe))
onUnmounted(() => {disposed=true;observer?.disconnect();document.removeEventListener('visibilitychange',observe)})
async function clearReminders(messages: MessageItem[]) {
  const epoch = state.messages?.epoch
  if (clearing.value || !epoch || !messages.length || !api.clearMessages) return
  // Clear the click-time snapshot only; messages arriving during the request remain.
  const keys = messages.map(item => item.key)
  clearing.value = true; error.value = ''
  try {
    await api.clearMessages(epoch, keys)
    await nextTick(); close.value?.focus({ preventScroll: true })
  } catch {
    if (state.messages?.epoch === epoch) error.value = '提醒未能清除，请重试。'
  } finally { clearing.value = false }
}
watch([conversation, () => state.messages?.epoch], () => { requested.value=false; error.value='' })
async function openDongdong() {
  if(opening.value)return
  const epoch=state.messages?.epoch, chat=conversation.value
  const current=()=>!disposed && state.messages?.epoch===epoch && conversation.value===chat
  opening.value=true;error.value='';requested.value=false
  try {
    if (!api.openDongdong) throw Error('请在桌面应用中打开咚咚。')
    if(chat && !epoch)throw Error('会话已过期，请重新打开。')
    await api.openDongdong(chat ? {epoch:epoch!,conversation:chat} : undefined)
    if(current())requested.value=true
  } catch(e) {
    if(current())error.value = typeof e==='string' ? e : e instanceof Error ? e.message : '未能打开咚咚，请重试。'
  } finally {opening.value=false}
}
</script>
<template>
  <section class="message-inbox" :role="closeable ? 'dialog' : 'region'" :aria-modal="false" aria-label="咚咚消息">
    <header class="message-inbox-header"><span><PhChatCircleText/>咚咚来信</span><span class="message-header-actions"><small>{{ api.messageConversations ? recentList.length : groups.length }} 个会话</small><button v-if="api.clearMessages && groups.length" class="message-clear-button" :disabled="clearing" title="清除桌宠当前全部提醒，保留咚咚聊天记录" @click="clearReminders(state.messages?.items ?? [])">{{ clearing ? '清除中…' : '清空提醒' }}</button><button v-if="closeable" ref="close" class="message-icon-button" aria-label="收起消息卡片" @click="emit('close')"><PhX/></button></span></header>
    <div v-if="activeGroup" class="message-conversation-header">
      <button v-if="groups.length>1 || !!api.messageConversations" class="message-icon-button message-back" aria-label="返回全部会话" @click="selected=null"><PhCaretLeft/></button>
      <span class="message-conversation-avatar"><PhLockSimple v-if="!preview"/><template v-else>{{activeGroup.title.slice(0,1)}}</template></span>
      <div class="message-conversation-copy"><h2 :title="preview ? activeGroup.title : undefined">{{preview ? activeGroup.title : '新消息'}}</h2><p>{{api.messageHistory ? '最近消息' : `${items.length} 条提醒`}}<span>最新在前</span></p></div>
      <button v-if="api.clearMessages && items.length" class="message-clear-button message-clear-conversation" :disabled="clearing" title="仅清除此会话在桌宠里的提醒" @click="clearReminders(items)">清除提醒</button>
    </div>
    <p v-else-if="groups.length || recentList.length" class="message-list-caption">最近会话<span>{{state.messages?.newCount || 0}} 条新提醒</span></p>
    <div ref="area" class="message-inbox-scroll" tabindex="0">
      <template v-if="!state.messages?.items.length && !recentList.length"><div class="message-empty"><PhChatCircleText/><b>{{ recentBusy ? '正在加载最近会话…' : state.messages?.status === 'ready' ? '暂时没有新提醒' : state.messages?.message || '等待本机咚咚连接' }}</b><p>消息来自本机咚咚，与额度账户独立。</p></div></template>
      <template v-else-if="!conversation && api.messageConversations"><button v-for="chat in recentList" :key="chat.key" class="message-group" @click="selected=chat.key"><span class="message-conversation-avatar">{{preview?chat.title.slice(0,1):'新'}}</span><span class="message-group-copy"><b>{{preview?chat.title:'新消息'}}</b><small>{{preview?chat.body:'你收到了一条新消息'}}</small></span><span class="message-group-meta"><time>{{time(chat.at)}}</time><b v-if="groups.find(g=>g.id===chat.key)?.fresh">{{groups.find(g=>g.id===chat.key)?.fresh}}</b><PhCaretRight v-else/></span></button></template>
      <template v-else-if="!conversation"><button v-for="group in groups" :key="group.id" class="message-group" @click="selected = group.id"><span class="message-conversation-avatar"><PhLockSimple v-if="!preview"/><template v-else>{{ group.title.slice(0, 1) }}</template></span><span class="message-group-copy"><b>{{ preview ? group.title : '新消息' }}</b><small>{{ !preview ? '你收到了一条新消息' : `${group.items[0].sender !== group.title ? group.items[0].sender + '：' : ''}${group.items[0].body}` }}</small><span>{{group.items.length}} 条提醒<span v-if="preview&&group.items.some(i=>i.mentioned)" class="message-mention">@我</span></span></span><span class="message-group-meta"><time>{{ time(group.items[0].at) }}</time><b v-if="group.fresh">{{ group.fresh>99?'99+':group.fresh }}</b><PhCaretRight v-else/></span></button></template>
      <MessageConversation v-else-if="api.messageHistory && conversation && preview" :key="`${state.messages?.epoch}:${conversation}`" :conversation="conversation" :revision="items.map(i=>i.key).join(',')"/>
      <template v-else><article v-for="item in items" :key="item.key" class="message-detail"><div class="message-sender" :data-message-key="item.fresh ? item.key : undefined"><span class="message-arrival-dot" aria-hidden="true"/><strong>{{ preview ? item.sender : '新消息' }}</strong><span v-if="preview&&item.mentioned" class="message-mention">@我</span><time>{{ time(item.at) }}</time></div><p>{{ preview ? item.body : '你收到了一条新消息' }}</p></article></template>
    </div>
    <p v-if="error" class="message-error" role="alert">{{ error }} <button v-if="api.messageConversations" @click="loadRecent">重试</button></p>
    <footer class="message-inbox-footer"><span class="message-footer-source" :title="state.messages?.account?.name">本机咚咚<small>{{requested ? '已请求打开咚咚' : api.messageHistory ? '阅读后发送已读回执' : '仅查看提醒'}}</small></span><button class="message-primary" :disabled="opening" @click="openDongdong">{{opening?'正在打开…':conversation?'打开此会话':'打开咚咚'}}<PhArrowUpRight/></button><button v-if="closeable" class="message-secondary" @click="emit('close')">收起</button></footer>
  </section>
</template>
