// Development-only visual fixture: exercise the same native renderer at its exact
// window dimensions while keeping Electron authentication and OS APIs out of scope.
import { DEFAULT_SETTINGS, HAMSTER_SKINS, type AppState, type Settings } from '../../src/shared/types'
const query = new URLSearchParams(location.search)
const size = (query.get('size') ?? 'standard') as Settings['size']
document.body.style.width = `${({ standard: 440, compact: 300, mini: 190 })[size]}px`
const state: AppState = { status: 'ready', quota: { limit: 300, used: 96, remaining: 204, percent: 68, exceeded: false, estimatedAt: '2026-09-09T18:00:00', serverAt: '2026-09-09T18:00:00', receivedAt: Date.now(), day: '2026-09-09' }, message: '仅用于组件测试 · 演示额度', syncing: false, persistentLogin: false, loginOpen: false, settings: { ...DEFAULT_SETTINGS, size, windowWidth: ({ standard: 440, compact: 300, mini: 190 })[size], theme: query.get('theme') === 'night' ? 'night' : 'day', outfit: 'sailor', scene: query.get('scene') === 'hamster' ? 'hamster' : query.get('scene') === 'beaver' ? 'beaver' : query.get('scene') === 'buddy' ? 'buddy' : 'aquarium', reducedMotion: query.get('motion') === 'off' }, version: '0.3.0-visual-test' }
const skin = HAMSTER_SKINS.find(s => s.id === query.get('skin'))
if (skin) state.settings.hamsterSkin = skin.id
const listeners = new Set<(s: AppState) => void>()
if (query.get('quota') === 'none') { state.quota = null; state.status = 'signed-out'; state.message = '演示未连接状态' }
if (state.quota && query.has('percent')) {
  const percent = Number(query.get('percent'))
  if (Number.isFinite(percent) && percent >= 0 && percent <= 100) { state.quota.percent = percent; state.quota.remaining = 3 * percent; state.quota.used = 300 - state.quota.remaining; state.quota.exceeded = percent === 0 }
}
const status = query.get('status')
if (status && ['ready','stale','expired','resetting','unavailable','forbidden','signed-out','connecting'].includes(status)) { state.status = status as AppState['status']; state.message = '状态契约组件测试 · ' + status }
const publish = () => listeners.forEach(fn => fn(structuredClone(state)))
window.emUse = {
  async beginGesture(mode) { document.body.dataset.gesture = mode; return 1 }, async moveGesture() { document.body.dataset.gestureMoved = 'true' }, async endGesture() { document.body.dataset.gestureEnded = 'true' },
  async getState() { return structuredClone(state) },
  async settings(patch) { Object.assign(state.settings, patch); if (patch.size) state.settings.windowWidth = ({ standard: 440, compact: 300, mini: 190 })[patch.size]; document.body.style.width = `${state.settings.windowWidth}px`; publish() },
  onState(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  async login() {}, async logout() {}, async refresh() {}, async hide() {}, async quit() {}, async openPortal() {}, async openReleases() {}, async screenshot() { return null },
  async openSettings() { window.dispatchEvent(new CustomEvent('open-settings')) },
}
await import('../../src/main')
