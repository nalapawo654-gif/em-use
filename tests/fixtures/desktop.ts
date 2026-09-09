// Development-only visual fixture: exercise the same native renderer at its exact
// window dimensions while keeping Electron authentication and OS APIs out of scope.
import { DEFAULT_SETTINGS, type AppState, type Settings } from '../../src/shared/types'
const query = new URLSearchParams(location.search)
const size = (query.get('size') ?? 'standard') as Settings['size']
document.body.style.width = `${({ standard: 440, compact: 300, mini: 190 })[size]}px`
const state: AppState = { status: 'ready', quota: { limit: 300, used: 96, remaining: 204, percent: 68, exceeded: false, estimatedAt: '2026-09-09T18:00:00', serverAt: '2026-09-09T18:00:00', receivedAt: Date.now(), day: '2026-09-09' }, message: '仅用于组件测试 · 演示额度', syncing: false, persistentLogin: false, loginOpen: false, settings: { ...DEFAULT_SETTINGS, size, windowWidth: ({ standard: 440, compact: 300, mini: 190 })[size], theme: query.get('theme') === 'night' ? 'night' : 'day', outfit: 'sailor' }, version: '0.2.0-visual-test' }
const listeners = new Set<(s: AppState) => void>()
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
