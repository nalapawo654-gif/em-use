<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { PhX, PhArrowUpRight, PhCaretLeft, PhChatCircleText, PhLockSimple } from '@phosphor-icons/vue'
import { api, appState as state } from '../bridge'
import { messageGroups } from '../shared/messageNotice'
const props = defineProps<{ closeable?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const opening = ref(false), requested = ref(false)
const selected = ref<string | null>(null), error = ref(''), area = ref<HTMLElement>(), close = ref<HTMLButtonElement>()
const groups = computed(() => messageGroups(state.messages?.items ?? []))
const conversation = computed(() => selected.value ?? (groups.value.length === 1 ? groups.value[0]?.id : null))
const items = computed(() => state.messages?.items.filter(i => i.conversation === conversation.value) ?? [])
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
watch(groups, value=>{if(selected.value&&!value.some(g=>g.id===selected.value))selected.value=null})
watch(() => state.messages?.epoch, () => { selected.value = null; pending.clear(); error.value = '' })
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
    <header class="message-inbox-header"><span><PhChatCircleText/>咚咚消息</span><button v-if="closeable" ref="close" class="message-icon-button" aria-label="收起消息卡片" @click="emit('close')"><PhX/></button></header>
    <p v-if="closeable" class="message-source-account">来自本机咚咚 · {{ state.messages?.account?.name || '等待登录' }}</p>
    <div ref="area" class="message-inbox-scroll" tabindex="0">
      <template v-if="!state.messages?.items.length"><div class="message-empty"><PhChatCircleText/><b>{{ state.messages?.status === 'ready' ? '暂时没有新提醒' : state.messages?.message || '等待本机咚咚连接' }}</b><p>消息来自本机咚咚，与额度账户独立。</p></div></template>
      <template v-else-if="!conversation"><button v-for="group in groups" :key="group.id" class="message-group" @click="selected = group.id"><span class="message-avatar">{{ state.settings.messagePreview ? group.title.slice(0, 1) : '咚' }}</span><span class="message-group-copy"><b>{{ group.title }}</b><small>{{ group.items[0].body }}</small></span><span class="message-group-meta"><b v-if="group.fresh">{{ group.fresh }}</b><time>{{ time(group.items[0].at) }}</time></span></button></template>
      <template v-else><button v-if="groups.length>1" class="message-back" @click="selected = null"><PhCaretLeft/>全部会话</button><article v-for="item in items" :key="item.key" class="message-detail"><div class="message-sender" :data-message-key="item.fresh ? item.key : undefined"><span class="message-avatar"><PhLockSimple v-if="!state.settings.messagePreview"/><template v-else>{{ item.sender.slice(0, 1) }}</template></span><strong>{{ item.title }}<small v-if="item.sender!==item.title">{{ item.sender }}</small></strong><time>{{ time(item.at) }}</time></div><span v-if="item.mentioned" class="message-mention">@我</span><p>{{ item.body }}</p></article></template>
    </div>
    <p v-if="error" class="message-error" role="alert">{{ error }}</p>
    <footer class="message-inbox-footer"><button class="message-primary" :disabled="opening" @click="openDongdong">{{opening?'正在打开…':requested?'再次打开咚咚':'打开咚咚'}}<PhArrowUpRight/></button><button v-if="closeable" class="message-secondary" @click="emit('close')">收起</button><small v-else>查看提醒不会标记咚咚已读</small></footer>
  </section>
</template>
