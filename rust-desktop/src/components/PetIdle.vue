<script setup lang="ts">
// Shared daily-flourish scheduler. Place inside a pet's `.pet-arc-host`; it animates
// that pet's main `.evolution-actor` with the pet's own flourish set while it is free.
import { onMounted, onUnmounted, ref } from 'vue'
import { appState } from '../bridge'
import { IDLE_BUSY, IDLE_BUSY_INSIDE, IDLE_FLOURISHES, nextIdleDelay, pickFlourish, type IdleScene } from '../shared/petIdle'

const props = defineProps<{ scene: IdleScene }>()
const anchor = ref<HTMLElement>()
let timer = 0, running: Animation | undefined, previous: string | undefined, host: HTMLElement | null = null, disposed = false

function actor() {
  const list = [...(host?.querySelectorAll<HTMLElement>('.evolution-actor, [data-pet-actor]') ?? [])]
  return list.map(el => ({ el, r: el.getBoundingClientRect() })).filter(a => a.r.width > 8 && a.r.height > 8).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]?.el
}
function free(el: HTMLElement | undefined): el is HTMLElement {
  if (!host || !el || document.hidden || appState.settings.reducedMotion) return false
  if (document.documentElement.dataset.petIntro) return false
  if (host.matches(IDLE_BUSY) || host.querySelector(IDLE_BUSY_INSIDE)) return false
  return el.dataset.cinematic !== 'true' && (el.dataset.awakeningPhase ?? 'idle') === 'idle'
}
function schedule(delay: number) { clearTimeout(timer); if (!disposed) timer = window.setTimeout(play, delay) }
function play() {
  const el = actor()
  if (!free(el)) { schedule(3000); return }
  const flourish = pickFlourish(IDLE_FLOURISHES[props.scene], previous)
  previous = flourish.name
  host!.dataset.idleFlourish = flourish.name
  running = el.animate(flourish.frames, { duration: flourish.duration, composite: 'add', easing: 'linear' })
  const done = () => { if (host?.dataset.idleFlourish === flourish.name) delete host.dataset.idleFlourish; running = undefined; schedule(nextIdleDelay(false)) }
  running.onfinish = done; running.oncancel = done
}
// Any direct handling of the pet (drag, click, opening a panel) wins immediately.
function interrupt() { running?.cancel() }

onMounted(() => {
  host = anchor.value?.closest<HTMLElement>('.pet-arc-host') ?? null
  host?.addEventListener('pointerdown', interrupt, true)
  schedule(nextIdleDelay(true))
})
onUnmounted(() => { disposed = true; clearTimeout(timer); host?.removeEventListener('pointerdown', interrupt, true); running?.cancel() })
</script>
<template><span ref="anchor" class="pet-idle-anchor" hidden></span></template>
