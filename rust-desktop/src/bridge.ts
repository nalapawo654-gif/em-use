import { reactive } from 'vue'
import { version } from '../package.json'
import { DEFAULT_SETTINGS, type AppState, type DesktopAPI, type Settings } from './shared/types'
import { normalizeQuota, quotaFreshness } from './shared/quota'
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
export function previewQuota(percent: number) {
  const date = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 19)
  local.quota = normalizeQuota({ code: '000200', data: { dailyCostLimit: '300', currentDayCost: String(300 * (1 - percent / 100)), currentTime: date, lastCostEstimateTime: date, quotaExceeded: percent <= 0 } })
  local.status = quotaFreshness(local.quota); local.message = '演示数据 · 未连接真实账户'; emit()
}
const previewAPI: DesktopAPI = {
  async getState() { return JSON.parse(JSON.stringify(local)) },
  async login(mode = 'manual') { local.loginMode = mode; local.quota = null; local.account = null; local.status = 'signed-out'; local.message = mode === 'dongdong' ? '请启动桌面应用，连接本机咚咚账户' : '请启动桌面应用，在官方窗口手动登录'; emit() },
  async logout() { local.loginMode = 'signed-out'; local.account = null; local.quota = null; local.status = 'signed-out'; local.message = '已退出登录，自动连接已暂停'; emit() },
  async refresh() { local.syncing = true; emit(); await new Promise(r => setTimeout(r, 600)); local.syncing = false; if (local.quota) previewQuota(local.quota.percent); else emit() },
  async settings(patch: Partial<Settings>) { Object.assign(local.settings, validateSettings(patch)); try { localStorage.setItem('em-use-preview-settings', JSON.stringify(local.settings)) } catch { /* Private browsing can disable storage; the current session still works. */ } emit() },
  async beginGesture() { return 0 }, async moveGesture() {}, async endGesture() {},
  async openSettings() { window.dispatchEvent(new CustomEvent('open-settings')) },
  async hide() { local.message = '桌面版可收起到系统托盘'; emit() },
  async quit() { local.message = '浏览器预览不会关闭标签页'; emit() },
  async openPortal() { await previewAPI.login('manual') },
  async openReleases() { window.open('http://172.27.12.77:5500/em-use/', '_blank', 'noopener') },
  async screenshot() { return null },
  onState(callback) { listeners.add(callback); return () => listeners.delete(callback) },
}
export const api = window.emUse ?? previewAPI
export const appState = reactive<AppState>({ ...local })
// Electron bridges callback return values too; never return Vue's reactive Proxy.
api.onState(s => { Object.assign(appState, s) })
if (isDesktop) void api.getState().then(s => Object.assign(appState, s))
