<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { PhX, PhArrowUpRight, PhCaretLeft, PhCaretRight, PhChatCircleText, PhLockSimple } from '@phosphor-icons/vue'
import { api, appState as state } from '../bridge'
import { messageGroups } from '../shared/messageNotice'
const props = defineProps<{ closeable?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const opening = ref(false), requested = ref(false)
const selected = ref<string | null>(null), error = ref(''), area = ref<HTMLElement>(), close = ref<HTMLButtonElement>()
const groups = computed(() => messageGroups(state.messages?.items ?? []))
const conversation = computed(() => selected.value)
const activeGroup = computed(() => groups.value.find(g => g.id === conversation.value))
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
    if(document.hidden || disposed)return
    const keys = entries.filter(e => e.isIntersecting && e.intersectionRatio >= .6).map(e => (e.target as HTMLElement).dataset.messageKey!).filter(k => !pending.has(k))
    if (!keys.length || !epoch || !api.ackMessages) return
    keys.forEach(k => pending.add(k))
    void api.ackMessages(epoch, keys).catch(() => { keys.forEach(k => pending.delete(k)); error.value = '提醒状态未保存，可稍后重试。' })
  }, { root: area.value, threshold: .6 })
  area.value?.querySelectorAll('[data-message-key]').forEach(e => observer?.observe(e))
}
watch(() => [conversation.value, state.messages?.epoch, items.value.map(i => i.key).join(',')], observe, { immediate: true, flush: 'post' })
watch(groups, value=>{
  if(selected.value&&!value.some(g=>g.id===selected.value))selected.value=null
  if(!selected.value&&value.length===1)selected.value=value[0].id
},{immediate:true})
watch(() => state.messages?.epoch, () => { selected.value = null; pending.clear(); error.value = '' }, {flush:'sync'})
nextTick(() => { if (props.closeable) close.value?.focus({ preventScroll: true }) })
onMounted(()=>document.addEventListener('visibilitychange',observe))
onUnmounted(() => {disposed=true;observer?.disconnect();document.removeEventListener('visibilitychange',observe)})
async function openDongdong() {
  if(opening.value)return
  opening.value=true;error.value='';requested.value=false
  try { if (!api.openDongdong) throw Error('请在桌面应用中打开咚咚。'); await api.openDongdong(); requested.value=true }
  catch(e) { error.value = typeof e==='string' ? e : e instanceof Error ? e.message : '未能打开咚咚，请重试。' }
  finally {opening.value=false}
}
</script>
<template>
  <section class="message-inbox" :role="closeable ? 'dialog' : 'region'" :aria-modal="false" aria-label="咚咚消息">
    <header class="message-inbox-header"><span><PhChatCircleText/>咚咚来信</span><span class="message-header-actions"><small>{{ groups.length }} 个会话</small><button v-if="closeable" ref="close" class="message-icon-button" aria-label="收起消息卡片" @click="emit('close')"><PhX/></button></span></header>
    <div v-if="activeGroup" class="message-conversation-header">
      <button v-if="groups.length>1" class="message-icon-button message-back" aria-label="返回全部会话" @click="selected=null"><PhCaretLeft/></button>
      <span class="message-conversation-avatar"><PhLockSimple v-if="!preview"/><template v-else>{{activeGroup.title.slice(0,1)}}</template></span>
      <div class="message-conversation-copy"><h2 :title="preview ? activeGroup.title : undefined">{{preview ? activeGroup.title : '新消息'}}</h2><p>{{items.length}} 条提醒<span>最新在前</span></p></div>
    </div>
    <p v-else-if="groups.length" class="message-list-caption">最近来信<span>{{state.messages?.newCount || 0}} 条新提醒</span></p>
    <div ref="area" class="message-inbox-scroll" tabindex="0">
      <template v-if="!state.messages?.items.length"><div class="message-empty"><PhChatCircleText/><b>{{ state.messages?.status === 'ready' ? '暂时没有新提醒' : state.messages?.message || '等待本机咚咚连接' }}</b><p>消息来自本机咚咚，与额度账户独立。</p></div></template>
      <template v-else-if="!conversation"><button v-for="group in groups" :key="group.id" class="message-group" @click="selected = group.id"><span class="message-conversation-avatar"><PhLockSimple v-if="!preview"/><template v-else>{{ group.title.slice(0, 1) }}</template></span><span class="message-group-copy"><b>{{ preview ? group.title : '新消息' }}</b><small>{{ !preview ? '你收到了一条新消息' : `${group.items[0].sender !== group.title ? group.items[0].sender + '：' : ''}${group.items[0].body}` }}</small><span>{{group.items.length}} 条提醒<span v-if="preview&&group.items.some(i=>i.mentioned)" class="message-mention">@我</span></span></span><span class="message-group-meta"><time>{{ time(group.items[0].at) }}</time><b v-if="group.fresh">{{ group.fresh>99?'99+':group.fresh }}</b><PhCaretRight v-else/></span></button></template>
      <template v-else><article v-for="item in items" :key="item.key" class="message-detail"><div class="message-sender" :data-message-key="item.fresh ? item.key : undefined"><span class="message-arrival-dot" aria-hidden="true"/><strong>{{ preview ? item.sender : '新消息' }}</strong><span v-if="preview&&item.mentioned" class="message-mention">@我</span><time>{{ time(item.at) }}</time></div><p>{{ preview ? item.body : '你收到了一条新消息' }}</p></article></template>
    </div>
    <p v-if="error" class="message-error" role="alert">{{ error }}</p>
    <footer class="message-inbox-footer"><span class="message-footer-source" :title="state.messages?.account?.name">本机咚咚<small>仅查看提醒</small></span><button class="message-primary" :disabled="opening" @click="openDongdong">{{opening?'正在打开…':requested?'再次打开咚咚':'打开咚咚'}}<PhArrowUpRight/></button><button v-if="closeable" class="message-secondary" @click="emit('close')">收起</button></footer>
  </section>
</template>
