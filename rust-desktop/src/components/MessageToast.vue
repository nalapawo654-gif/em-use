<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { PhX } from '@phosphor-icons/vue'
import { api, appState as state } from '../bridge'
import { MESSAGE_PERSONAS, messageWindowError } from '../shared/messageNotice'
const hovering = ref(false), opening = ref(false), error = ref('')
const persona = computed(() => MESSAGE_PERSONAS[state.settings.scene])
const item = computed(() => state.messages?.status === 'ready' && state.messages.epoch === state.messageToast?.epoch
  ? state.messages.items.find(i => i.key === state.messageToast?.key) : undefined)
let remaining = 5000, last = Date.now()
watch(() => item.value?.key, () => { remaining = 5000; last = Date.now(); error.value = '' })
const timer = setInterval(() => {
  const now = Date.now(), delta = now - last; last = now
  if (!item.value || hovering.value || opening.value || document.hidden || document.querySelector(':focus-visible')) return
  remaining -= Math.min(delta, 500)
  if (remaining <= 0) { remaining = Infinity; void api.hide() }
}, 100)
onUnmounted(() => clearInterval(timer))
async function open() {
  if (opening.value) return
  opening.value = true
  try { await api.openMessagePanel?.() } catch(e) {
    error.value = `${messageWindowError(e)} 点击角色旁的小道具重试。`
  }
  finally { opening.value = false }
}
</script>
<template>
  <div class="message-toast-window" :class="[`side-${state.messageToast?.side}`, {'message-gentle': state.settings.reducedMotion}]" :style="{'--msg-color':persona.color}" @mouseenter="hovering=true" @mouseleave="hovering=false" @keydown.esc="api.hide()">
    <div v-if="item" class="message-bubble">
      <button class="message-bubble-content" :disabled="opening" aria-label="查看咚咚消息" @click="open"><b>咚咚 · {{ state.settings.messagePreview ? item.sender : '新消息' }}</b><span>{{item.body}}</span></button>
      <button class="message-bubble-close" aria-label="收起消息气泡" @click="api.hide()"><PhX/></button>
    </div>
    <p v-if="error" class="message-error" role="alert">{{error}}</p>
  </div>
</template>
