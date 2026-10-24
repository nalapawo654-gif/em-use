// Browser-only fixture: no real Tauri commands or accounts.
import { DEFAULT_SETTINGS, type AppState, type DesktopAPI } from '../../src/shared/types'
import { validateSettings } from '../../src/shared/settings'
const state: AppState = { settings: { ...DEFAULT_SETTINGS, scene: 'hermit', theme: 'day', messageEnabled: false, calendarEnabled: false }, status: 'ready', account: { id: 'fixture' }, quota: { limit: 100, used: 32, remaining: 68, percent: 68, exceeded: false, estimatedAt: '', serverAt: '', receivedAt: Date.now(), day: '' }, message: '浏览器演示桥接，非真实账户', syncing: false, version: 'fixture', persistentLogin: false, loginOpen: false }
const listeners = new Set<(s: AppState) => void>()
const emit = () => listeners.forEach(fn => fn(structuredClone(state)))
const noop = async () => {}
function quota(value: number | null) {
  state.status = value === null ? 'signed-out' : 'ready'
  state.quota = value === null ? null : { ...state.quota!, limit: 100, remaining: value, used: 100 - value, percent: value, exceeded: value === 0, receivedAt: Date.now() }
  state.codex = { status: value === null ? 'unavailable' : 'ready', message: '演示额度', syncing: false, account: { id: 'fixture', name: '演示账户', plan: null }, receivedAt: Date.now(), buckets: [{ id: 'codex', name: 'Codex', plan: null, windows: [ { id: 'p', remainingPercent: value, windowDurationMins: 300, resetsAt: 1800000000 }, { id: 'w', remainingPercent: value === null ? null : Math.min(100, value + 10), windowDurationMins: 10080, resetsAt: 1800600000 } ] }] }
}
quota(68)
window.emUse = { getState: async () => structuredClone(state), onState: fn => { listeners.add(fn); return () => listeners.delete(fn) }, settings: async patch => { Object.assign(state.settings, validateSettings(patch)); emit() }, login: noop, logout: noop, refresh: noop, openSettings: noop, hide: noop, quit: noop, openPortal: noop, openReleases: noop, screenshot: async () => null, beginGesture: async () => 1, moveGesture: noop, endGesture: noop } satisfies DesktopAPI
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'hermit-fixture') return
  const { settings, percent, stale, weeklyOnly } = event.data
  if (settings) Object.assign(state.settings, validateSettings(settings))
  if (percent !== undefined) quota(percent)
  if (stale !== undefined && state.codex) state.codex.status = stale ? 'stale' : 'ready'
  if (weeklyOnly && state.codex) state.codex.buckets[0]!.windows = state.codex.buckets[0]!.windows.filter(w => w.id === 'w')
  emit()
})
await import('../../src/main')
