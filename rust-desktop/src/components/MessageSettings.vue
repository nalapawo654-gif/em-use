<script setup lang="ts">
import { computed, ref } from 'vue'
import { api, appState as state } from '../bridge'
import type { Settings } from '../shared/types'
import MessageInbox from './MessageInbox.vue'
const error = ref('')
const messageAccount = computed(() => state.messages?.account?.name || '等待本机咚咚登录')
async function set(patch: Partial<Settings>) { try { await api.settings(patch); error.value='' } catch { error.value='设置未保存，请重试。' } }
</script>
<template>
  <div class="message-settings"><h2>消息账户 · 本机咚咚</h2><p class="section-description">消息始终跟随本机咚咚。切换或退出额度账户，不影响消息接收。</p>
    <div class="message-account-card"><span class="message-account-dot" :class="state.messages?.status"/><div><b>{{ messageAccount }}</b><p v-if="state.messages?.account?.id">账户 {{ state.messages.account.id }}</p><p>{{ state.messages?.message || '等待本机咚咚连接' }}</p></div><span>咚咚</span></div>
    <div class="message-account-comparison"><span>额度账户<b>{{ state.account?.name || state.account?.id || '未连接额度账户' }}</b></span><span>消息账户<b>{{ messageAccount }}</b></span><small>两个账户可以不同，各自独立。</small></div>
    <label v-for="item in [{ key:'messageEnabled',title:'桌宠消息提醒',help:'新消息通过专属小道具和气泡提醒。' },{ key:'messagePreview',title:'显示消息正文',help:'关闭后，气泡与卡片仅显示“你收到了一条新消息”。' },{ key:'messageRespectMute',title:'遵循咚咚免打扰',help:'免打扰会话不产生新的桌宠提醒。' }]" :key="item.key" class="setting-row"><span><b>{{ item.title }}</b><small>{{ item.help }}</small></span><input type="checkbox" role="switch" :checked="state.settings[item.key as keyof Settings] === true" @change="set({ [item.key]: ($event.target as HTMLInputElement).checked })"/></label>
    <div class="message-pause-controls"><span>暂停提醒</span><button @click="set({messagePausedUntil:Date.now()+30*60_000})">30 分钟</button><button @click="set({messagePausedUntil:Date.now()+60*60_000})">1 小时</button><button @click="set({messagePausedUntil:0})">恢复提醒</button></div>
    <p v-if="error" role="alert">{{ error }}</p><h2>最近收到的提醒</h2><MessageInbox/>
  </div>
</template>
