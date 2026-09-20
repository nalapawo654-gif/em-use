<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { api, appState as state } from '../bridge'
import type { ReplyContact } from '../shared/types'
const data = computed(() => state.autoReply)
const selected = ref<string[]>([])
const text = ref('我现在不方便回复，稍后联系你。急事可以电话联系。')
const search = ref('')
const busy = ref(false)
const error = ref('')
const ready = computed(() => !!api.configureAutoReply && state.messages?.status === 'ready')
const results = ref<ReplyContact[]>([])
const searching = ref(false)
const searchError = ref('')
const searched = ref(false)
const hasMore = ref(false)
const page = ref(0)
let ticket = 0
let timer: ReturnType<typeof setTimeout> | undefined
const contacts = computed(() => search.value.trim() ? results.value : (data.value?.contacts ?? []))
const chosen = computed(() => (data.value?.contacts ?? []).filter(c => selected.value.includes(c.key)))
const searchReady = computed(() => ready.value && state.settings.messagePreview && !data.value?.enabled && !!api.searchReplyUsers)
function cancelSearch() { ++ticket; clearTimeout(timer); searching.value = false }
async function findUsers(more = false) {
  clearTimeout(timer)
  if (!searchReady.value || !data.value || !api.searchReplyUsers || !search.value.trim()) return
  const turn = ++ticket, epoch = data.value.epoch, keyword = search.value.trim(), nextPage = more ? page.value + 1 : 1
  searching.value = true; searchError.value = ''
  try {
    const response = await api.searchReplyUsers(epoch, keyword, nextPage)
    if (turn !== ticket || data.value?.epoch !== epoch || response.epoch !== epoch) return
    const merged = more ? [...results.value, ...response.items] : response.items
    results.value = [...new Map(merged.map(c => [c.key,c])).values()]
    page.value = nextPage; hasMore.value = response.hasMore; searched.value = true
  } catch (e) { if (turn === ticket) { searchError.value = typeof e === 'string' ? e : '咚咚用户查询失败，请重试。'; searched.value = true } }
  finally { if (turn === ticket) searching.value = false }
}
watch([search, searchReady], () => {
  cancelSearch(); results.value = []; page.value = 0; hasMore.value = false; searchError.value = ''; searched.value = false
  if (searchReady.value && search.value.trim()) { searching.value = true; timer = setTimeout(() => void findUsers(), 350) }
})
onUnmounted(cancelSearch)
watch(() => data.value?.epoch, () => {
  selected.value = data.value?.contacts.filter(c => c.selected).map(c => c.key) ?? []
  text.value = data.value?.text || '我现在不方便回复，稍后联系你。急事可以电话联系。'
  cancelSearch(); results.value = []; error.value = ''; search.value = ''
}, { immediate: true })
async function save(enabled: boolean) {
  if (!api.configureAutoReply || !data.value) return
  const epoch = data.value.epoch
  busy.value = true; error.value = ''
  try { await api.configureAutoReply({ epoch, enabled, contacts: [...selected.value], text: text.value.trim() }) }
  catch (e) { if (data.value?.epoch === epoch) error.value = typeof e === 'string' ? e : '自动回复设置未保存，请重试。' }
  finally { busy.value = false }
}
</script>
<template>
  <section class="auto-reply-settings" aria-labelledby="auto-reply-title">
    <div class="reply-heading"><h2 id="auto-reply-title">私聊自动回复 <small>试用</small></h2><span class="reply-status" :class="{ active:data?.enabled }">{{ data?.enabled ? '已开启' : '已关闭' }}</span></div>
    <p class="section-description">只回复你选中的私聊联系人。所有群聊均不回复，包括群内 @你。</p>
    <template v-if="api.configureAutoReply">
      <fieldset :disabled="busy || !!data?.enabled || !ready">
        <legend>选择联系人 <span>{{ selected.length }}/20</span></legend>
        <div v-if="chosen.length" class="reply-chosen" aria-label="已选人员"><span v-for="contact in chosen" :key="contact.key">{{ contact.name }}<small>{{ contact.id }}</small><button type="button" :aria-label="`移除 ${contact.name}`" @click="selected = selected.filter(key => key !== contact.key)">×</button></span></div>
        <input v-model="search" class="reply-search" type="search" aria-label="搜索私聊联系人" placeholder="搜索咚咚通讯录：姓名或账号" maxlength="80" :disabled="!state.settings.messagePreview" @keydown.enter.prevent="findUsers()"/>
        <p class="reply-preview">{{ state.settings.messagePreview ? '可搜索未聊过天的同事；勾选只加入名单，不会主动发消息。' : '请先开启显示消息正文，以便核对联系人身份。' }}</p>
        <p v-if="searching" class="reply-preview" role="status">正在搜索咚咚通讯录…</p>
        <p v-if="searchError" role="alert">{{ searchError }} <button type="button" @click="findUsers()">重试搜索</button></p>
        <div class="reply-contacts">
          <label v-for="contact in contacts" :key="contact.key"><input v-model="selected" type="checkbox" :value="contact.key" :disabled="selected.length >= 20 && !selected.includes(contact.key)"/><span>{{ contact.name }}<small>{{ contact.id }}<template v-if="contact.department"> · {{ contact.department }}</template></small></span><em v-if="contact.paused">你已回复 · 已暂停</em></label>
          <p v-if="!contacts.length && !searching && !searchError">{{ !ready ? '连接本机咚咚并恢复消息提醒后，可选择联系人。' : searched ? '咚咚通讯录未找到匹配人员，请换个姓名或账号。' : '输入姓名或账号，搜索咚咚通讯录。' }}</p>
        </div>
        <button v-if="hasMore" class="reply-more" type="button" :disabled="searching" @click="findUsers(true)">加载更多人员</button>
        <label class="reply-text-label" for="auto-reply-text">回复内容 <span>{{ text.length }}/300</span></label>
        <textarea id="auto-reply-text" v-model="text" rows="3" maxlength="300" placeholder="输入固定回复内容"/>
        <p class="reply-preview">发送时自动加上「自动回复」标记。</p>
      </fieldset>
      <p class="reply-rules">对方停下 5 秒后回复；每人 30 分钟最多一次。你主动回复后，该联系人暂停自动回复。重启、断开咚咚或暂停消息提醒后关闭，不补发历史消息。</p>
      <div class="reply-actions"><button v-if="data?.enabled" :disabled="busy" @click="save(false)">关闭自动回复</button><button v-else class="primary" :disabled="busy || !ready || !selected.length || !text.trim() || !state.settings.messagePreview" @click="save(true)">{{ busy ? '保存中…' : '开启 1 小时' }}</button><small v-if="data?.enabled">{{ new Date(data.until).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }} 自动关闭 · 修改内容请先关闭</small></div>
      <p v-if="error" role="alert">{{ error }}</p>
      <div v-if="data?.logs.length" class="reply-logs" aria-live="polite"><h3>最近回复记录</h3><p v-for="(log,i) in data.logs" :key="i"><b>{{ log.name }}</b><time>{{ new Date(log.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) }}</time><span :class="{failed:!log.ok}">{{ log.message }}</span></p></div>
    </template>
    <p v-else class="section-description">请在桌面客户端中配置，浏览器预览不会发送消息。</p>
  </section>
</template>
<style scoped>
.auto-reply-settings{margin:24px 0;padding:20px;border:1px solid var(--line,#ddd7cd);border-radius:16px;background:var(--surface,rgba(255,255,255,.5))}.reply-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.reply-heading h2{margin:0}.reply-heading h2 small{font-size:11px;font-weight:500;margin-left:6px;opacity:.65}.reply-status{font-size:12px;white-space:nowrap;color:#6c777b}.reply-status.active{color:#387963}fieldset{border:0;padding:0;margin:18px 0 0;min-width:0}legend,.reply-text-label{font-size:13px;font-weight:600;margin-bottom:8px}legend span,.reply-text-label span{font-weight:400;opacity:.6;margin-left:8px}.reply-search,textarea{box-sizing:border-box;width:100%;border:1px solid var(--line,#d7d2c9);border-radius:8px;padding:10px;font:inherit;color:inherit;background:transparent}.reply-contacts{max-height:180px;overflow:auto;margin:8px 0 16px}.reply-contacts label{display:flex;gap:10px;align-items:center;padding:9px 4px;cursor:pointer}.reply-contacts label span{overflow-wrap:anywhere}.reply-contacts small{display:block;font-size:11px;opacity:.6}.reply-contacts em{font-size:11px;margin-left:auto;font-style:normal;color:#a4753e}.reply-contacts p,.reply-preview,.reply-rules{font-size:12px;line-height:1.7;opacity:.75}.reply-text-label{display:block}textarea{resize:vertical;min-height:80px}.reply-preview{margin:6px 0}.reply-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.reply-actions button{padding:9px 16px;border-radius:9px;border:1px solid var(--line,#d7d2c9);cursor:pointer;background:transparent;color:inherit}.reply-actions .primary{background:#9b692d;color:white;border-color:transparent}.reply-actions button:disabled{opacity:.45;cursor:default}.reply-actions small{font-size:11px;opacity:.7}.reply-logs{border-top:1px solid var(--line,#ddd7cd);margin-top:16px;padding-top:12px}.reply-logs h3{font-size:13px}.reply-logs p{font-size:12px;display:flex;flex-wrap:wrap;gap:8px}.reply-logs span{width:100%;color:#387963}.reply-logs .failed,[role=alert]{color:#b84d3b}.reply-logs time{margin-left:auto;opacity:.65}:focus-visible{outline:2px solid #ae854f;outline-offset:3px}
.reply-chosen{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.reply-chosen>span{display:flex;align-items:center;gap:5px;background:rgba(120,150,170,.12);padding:5px 8px;border-radius:8px;font-size:12px}.reply-chosen small{opacity:.65}.reply-chosen button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:17px}.reply-more{margin:0 0 16px;padding:5px 10px;background:transparent;color:inherit;border:1px solid var(--line,#d7d2c9);border-radius:6px;cursor:pointer}
</style>
