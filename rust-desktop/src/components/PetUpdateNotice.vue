<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhArrowUpRight, PhX, PhArrowClockwise } from '@phosphor-icons/vue'
import { api, appState as state } from '../bridge'
import { UPDATE_PERSONAS, updateNoticeVisible, updateProgress } from '../shared/updateNotice'
import UpdateParcel from './UpdateParcel.vue'

const props = defineProps<{ blocked?: boolean }>()
const emit = defineEmits<{ openChange: [value: boolean] }>()
const host = ref<HTMLElement>(), launcher = ref<HTMLButtonElement>(), closeButton = ref<HTMLButtonElement>()
const opened = ref(false), pending = ref(false), saving = ref(false), error = ref('')
const persona = computed(() => UPDATE_PERSONAS[state.settings.scene])
const visible = computed(() => updateNoticeVisible(state.update))
const busy = computed(() => pending.value || ['downloading', 'installing'].includes(state.update?.status ?? ''))
const snoozed = computed(() => !busy.value && state.update?.version === state.dismissedUpdateVersion)
const progress = computed(() => updateProgress(state.update))
const manualUpdate = computed(() => state.updateMode === 'manual')
const status = computed(() => state.update?.status ?? 'idle')
const badge = computed(() => busy.value ? (status.value === 'installing' ? '正在安装' : progress.value === null ? '正在下载' : `下载 ${progress.value}%`) : status.value === 'error' ? '更新未完成' : '新版本')
let parent: HTMLElement | null = null
const inertBefore = new Map<HTMLElement, boolean>()
function releaseSiblings() { for (const [element, inert] of inertBefore) element.inert = inert; inertBefore.clear(); parent?.classList.remove('update-letter-open') }
function guardEscape(event: KeyboardEvent) { if (event.key === 'Escape' && opened.value && (parent?.contains(event.target as Node) || event.target === document.body || event.target === document.documentElement)) { event.preventDefault(); event.stopImmediatePropagation(); void dismiss() } }
function setOpen(value: boolean, restore = false) {
  opened.value = value
  if (!value && restore) void nextTick(() => launcher.value?.focus({ preventScroll: true }))
}
async function openDetails() {
  try { if (api.openUpdates) await api.openUpdates(); else await api.openSettings() }
  catch { error.value = '更新说明未能打开，请重试。' }
}
async function dismiss() {
  if (saving.value) return
  if (busy.value) { setOpen(false, true); return }
  const version = state.update?.version
  if (!version) { setOpen(false); return }
  saving.value = true; error.value = ''
  try { if (!api.dismissUpdate) throw Error(); await api.dismissUpdate(version); setOpen(false, true) }
  catch { error.value = '暂时没记住“稍后”，请再试一次。' }
  finally { saving.value = false }
}
async function install() {
  if (busy.value || saving.value) return
  if (manualUpdate.value) {
    error.value = ''
    try { await api.openReleases() } catch { error.value = '下载页未能打开，请稍后重试。' }
    return
  }
  error.value = ''; pending.value = true
  await nextTick(); closeButton.value?.focus({ preventScroll: true })
  try { if (!api.installUpdate) throw Error(); await api.installUpdate() }
  catch { error.value = state.update?.status === 'error' ? '' : '更新未开始，请稍后重试。' }
  finally { pending.value = false }
}
async function retry() {
  if (pending.value) return
  error.value = ''; pending.value = true
  await nextTick(); closeButton.value?.focus({ preventScroll: true })
  try { if (!api.checkUpdate) throw Error(); await api.checkUpdate() }
  catch { error.value = '暂时无法检查，请连接内网后重试。' }
  finally { pending.value = false }
}
watch(opened, async value => {
  emit('openChange', value)
  releaseSiblings()
  if (!value || !parent) return
  parent.classList.add('update-letter-open')
  for (const sibling of parent.children) if (sibling instanceof HTMLElement && sibling !== host.value) { inertBefore.set(sibling, sibling.inert); sibling.inert = true }
  await nextTick(); closeButton.value?.focus({ preventScroll: true })
}, { flush: 'post' })
watch([() => state.settings.scene, () => state.update?.version], () => { error.value = ''; setOpen(false) })
watch(() => props.blocked || !visible.value, blocked => { if (blocked) setOpen(false) })
onMounted(() => { parent = host.value?.parentElement ?? null; document.addEventListener('keydown', guardEscape, true) })
onUnmounted(() => { emit('openChange', false); releaseSiblings(); document.removeEventListener('keydown', guardEscape, true) })
</script>
<template>
  <div ref="host" v-show="visible && !blocked" class="pet-update-notice" :class="[`update-${state.settings.scene}`, `motion-${persona.motion}`, { 'is-open': opened, 'is-snoozed': snoozed, 'is-busy': busy, 'is-gentle': state.settings.reducedMotion }]" :data-update-version="state.update?.version" data-pet-gesture @contextmenu.stop.prevent @wheel.stop @pointerdown.stop @click.stop>
    <button v-if="!opened" ref="launcher" class="update-letter-button" :aria-label="`${persona.object}：${badge} v${state.update?.version}，查看版本更新`" :aria-expanded="opened" @click="setOpen(true)">
      <UpdateParcel :scene="state.settings.scene"/><span class="update-letter-label"><b>{{ badge }}</b><small>{{ snoozed ? '来信还在' : `v${state.update?.version}` }}</small></span><span class="update-letter-dot" aria-hidden="true"></span>
    </button>
    <section v-else class="update-letter" role="dialog" aria-modal="false" :aria-label="`${persona.tag} · 版本更新`">
      <header class="update-letter-header"><UpdateParcel :scene="state.settings.scene"/><div><small>{{ persona.tag }}</small><strong>新版本 <span>v{{ state.update?.version }}</span></strong></div><button ref="closeButton" class="update-close" :disabled="saving" :aria-label="busy ? '收起更新进度' : '稍后更新，关闭来信'" @click="dismiss"><PhX/></button></header>
      <div class="update-letter-scroll" tabindex="0"><h2>{{ persona.title }}</h2><p class="update-story">{{ persona.body }}</p><p v-if="state.update?.notes && !busy && status !== 'error'" class="update-release-notes">{{ state.update.notes }}</p><p v-if="status === 'error'" class="update-error" role="alert">{{ state.update?.message }}</p><p v-if="error" class="update-error" role="alert">{{ error }}</p><div v-if="busy" class="update-transfer" role="status"><span>{{ state.update?.message || '正在开始更新…' }}</span><progress :value="progress ?? undefined" max="100" aria-label="更新下载进度"></progress><small>{{ progress === null ? '请稍候' : `${progress}%` }}</small></div></div>
      <div class="update-letter-footer"><p class="update-restart-note">{{ manualUpdate ? '下载新版后，请退出并手动替换应用' : busy ? '安装完成后将重启 EM Use' : '安装后会重启 EM Use' }}<button class="update-details" aria-label="在设置中查看更新说明" @click="openDetails">说明 ↗</button></p><div class="update-letter-actions"><button v-if="status === 'error'" class="update-primary" :disabled="pending || saving" @click="retry"><PhArrowClockwise/>重新检查</button><button v-else class="update-primary" :disabled="busy || saving" @click="install">{{ manualUpdate ? '前往下载' : busy ? '更新进行中' : '更新并重启' }}<PhArrowUpRight v-if="!busy"/></button><button class="update-later" :disabled="saving" @click="dismiss">{{ busy ? '收起进度' : '稍后' }}</button></div></div>
      <span class="update-stamp" aria-hidden="true">{{ persona.stamp }}</span>
    </section>
  </div>
</template>
