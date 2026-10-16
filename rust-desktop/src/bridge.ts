import { reactive, computed } from 'vue'
import { version } from '../package.json'
import { DEFAULT_SETTINGS, type AppState, type DesktopAPI, type Settings } from './shared/types'
import { normalizeQuota, quotaFreshness } from './shared/quota'
import { quotaPresentation } from './shared/quotaSource'
import { validateSettings } from './shared/settings'
export const isDesktop = !!window.emUse
function previewSettings() {
  let saved: Partial<Settings> = {}
  try { saved = validateSettings(JSON.parse(localStorage.getItem('em-use-preview-settings') ?? '{}')) } catch { /* Preview links still work when storage is unavailable. */ }
  return { ...saved, ...validateSettings({ scene: new URLSearchParams(location.search).get('scene') }) }
}
const local = reactive<AppState>({ loginMode: 'dongdong', account: null, status: 'signed-out', quota: null, message: '登录后，让小鱼陪你看额度', syncing: false, settings: { ...DEFAULT_SETTINGS, ...(!isDesktop ? previewSettings() : {}) }, version, persistentLogin: false, loginOpen: false })
const listeners = new Set<(s: AppState) => void>()
function emit() { listeners.forEach(fn => fn(JSON.parse(JSON.stringify(local)))) }
function previewCodexQuota(percent: number) {
  local.codex = {
    status: 'ready', message: '演示数据 · 未连接真实账户', syncing: false,
    account: { id: 'preview', name: '演示账户', plan: '演示套餐' }, receivedAt: Date.now(),
    buckets: [{ id: 'codex', name: 'Codex', plan: null, windows: [
      { id: 'primary', remainingPercent: percent, windowDurationMins: 300, resetsAt: Math.floor(Date.now()/1000) + 7200 },
      { id: 'secondary', remainingPercent: Math.min(100, percent + 10), windowDurationMins: 10080, resetsAt: Math.floor(Date.now()/1000) + 172800 },
    ] }],
  }
  emit()
}
export function previewQuota(percent: number) {
  if (local.settings.quotaSource === 'codex') { previewCodexQuota(percent); return }
  const date = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 19)
  local.quota = normalizeQuota({ code: '000200', data: { dailyCostLimit: '300', currentDayCost: String(300 * (1 - percent / 100)), currentTime: date, lastCostEstimateTime: date, quotaExceeded: percent <= 0 } })
  local.status = quotaFreshness(local.quota); local.message = '演示数据 · 未连接真实账户'; emit()
}
const previewAPI: DesktopAPI = {
  async refreshCodex() { previewCodexQuota(local.codex?.buckets[0]?.windows[0]?.remainingPercent ?? 62) },
  async openCloudPortal() { await previewAPI.login('manual') },
  async getState() { return JSON.parse(JSON.stringify(local)) },
  async login(mode) { if (!mode && local.settings.quotaSource === 'codex') { window.dispatchEvent(new CustomEvent('open-settings')); return } mode ??= 'manual'; local.loginMode = mode; local.quota = null; local.account = null; local.status = 'signed-out'; local.message = mode === 'dongdong' ? '请启动桌面应用，连接本机咚咚账户' : '请启动桌面应用，在官方窗口手动登录'; emit() },
  async logout() { local.loginMode = 'signed-out'; local.account = null; local.quota = null; local.status = 'signed-out'; local.message = '已退出登录，自动连接已暂停'; emit() },
  async refresh() { if (local.settings.quotaSource === 'codex') { await previewAPI.refreshCodex!(); return } local.syncing = true; emit(); await new Promise(r => setTimeout(r, 600)); local.syncing = false; if (local.quota) previewQuota(local.quota.percent); else emit() },
  async settings(patch: Partial<Settings>) { Object.assign(local.settings, validateSettings(patch)); if (patch.codexEnabled === false) local.codex = { status: 'signed-out', message: 'Codex 监控已断开', syncing: false, account: null, buckets: [], receivedAt: null }; try { localStorage.setItem('em-use-preview-settings', JSON.stringify(local.settings)) } catch { /* Private browsing can disable storage; the current session still works. */ } emit() },
  async beginGesture() { return 0 }, async moveGesture() {}, async endGesture() {},
  async openSettings() { window.dispatchEvent(new CustomEvent('open-settings')) },
  async hide() { local.message = '桌面版可收起到系统托盘'; emit() },
  async quit() { local.message = '浏览器预览不会关闭标签页'; emit() },
  async openPortal() { if (local.settings.quotaSource === 'codex') { window.dispatchEvent(new CustomEvent('open-settings')); window.dispatchEvent(new CustomEvent('open-account')); return } await previewAPI.login('manual') },
  async openReleases() { window.open('http://172.27.12.77:5500/em-use/', '_blank', 'noopener') },
  async screenshot() { return null },
  onState(callback) { listeners.add(callback); return () => listeners.delete(callback) },
}
export const api = window.emUse ?? previewAPI
export const appState = reactive<AppState>({ ...local })
// Electron bridges callback return values too; never return Vue's reactive Proxy.
api.onState(s => { Object.assign(appState, s) })
if (isDesktop) void api.getState().then(s => Object.assign(appState, s))

// A read-only view for pets; cloud account settings retain the original independent state.
export const quotaDisplay = computed(() => quotaPresentation(appState))
export const quotaState = new Proxy(appState, {
  get(target, key, receiver) {
    if (['status', 'message', 'syncing'].includes(String(key))) return quotaDisplay.value[key as 'status' | 'message' | 'syncing']
    if (target.settings.quotaSource === 'codex') {
      if (key === 'quota') return null
      if (key === 'account') return target.codex?.account ?? null
      if (key === 'loginOpen') return false
    }
    return Reflect.get(target, key, receiver)
  },
})
