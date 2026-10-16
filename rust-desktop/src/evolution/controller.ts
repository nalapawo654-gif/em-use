import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { api, appState, quotaDisplay } from '../bridge'
import { evolutionAppearance } from './appearance'
import { evolutionAssetsReady } from './readiness'
import { initialEvolution, stepEvolution } from './state'

export const evolution = reactive(initialEvolution())
export const evolutionBlocked = ref(false)
const blockers = new Set<symbol>()
export function setEvolutionBlocked(owner: symbol, blocked: boolean) {
  if (blocked) blockers.add(owner); else blockers.delete(owner)
  evolutionBlocked.value = blockers.size > 0
}
export const evolutionHidden = ref(document.hidden)
export const systemReduced = ref(matchMedia('(prefers-reduced-motion: reduce)').matches)
export const evolutionMotion = computed(() => appState.settings.evolutionMotion === 'off' ? 'off' : appState.settings.reducedMotion || systemReduced.value ? 'light' : appState.settings.evolutionMotion)
export const evolutionGlow = computed(() => quotaDisplay.value.status === 'ready' && quotaDisplay.value.percent !== null ? Math.max(0, Math.min(1, quotaDisplay.value.percent / 100)) : 0)
export function useEvolutionController() {
  let timer: ReturnType<typeof setTimeout> | undefined, stop: (() => void) | undefined, disposed = false
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  function tick() {
    clearTimeout(timer)
    const status = quotaDisplay.value.status
    Object.assign(evolution, stepEvolution(evolution, {
      source: appState.settings.quotaSource, scene: appState.settings.scene, appearance: evolutionAppearance(appState.settings), assetsReady: evolutionAssetsReady.value,
      enabled: appState.settings.codexEnabled, ready: status === 'ready' && quotaDisplay.value.percent !== null,
      retain: !!appState.codex?.account && ['ready', 'stale', 'unavailable'].includes(status),
      blocked: evolutionBlocked.value, hidden: evolutionHidden.value, motion: evolutionMotion.value,
    }, performance.now()))
    if (evolution.phase !== 'idle') timer = setTimeout(tick, 40)
  }
  const visibility = () => { evolutionHidden.value = document.hidden }
  const preference = () => { systemReduced.value = media.matches }
  onMounted(async () => {
    document.addEventListener('visibilitychange', visibility); media.addEventListener('change', preference)
    // Wait for native hydration, otherwise saved Codex selection looks like a click.
    try { const state = await api.getState(); if (disposed) return; Object.assign(appState, state) } catch { /* Existing UI reports connection errors. */ }
    if (disposed) return
    Object.assign(evolution, initialEvolution())
    stop = watch(() => [appState.settings.quotaSource, evolutionAppearance(appState.settings), evolutionAssetsReady.value, appState.settings.codexEnabled, appState.codex?.account?.id, quotaDisplay.value.status, quotaDisplay.value.percent, evolutionBlocked.value, evolutionHidden.value, evolutionMotion.value], tick, { immediate: true, flush: 'post' })
  })
  onUnmounted(() => { disposed = true; stop?.(); clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', preference) })
}
