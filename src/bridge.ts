import { reactive } from 'vue'
import { DEFAULT_SETTINGS, type AppState, type DesktopAPI, type Settings } from './shared/types'
import { normalizeQuota, quotaFreshness } from './shared/quota'
export const isDesktop = !!window.emUse
const local = reactive<AppState>({ status: 'signed-out', quota: null, message: '登录后，让小鱼陪你看额度', syncing: false, settings: { ...DEFAULT_SETTINGS }, version: '0.2.0', persistentLogin: false, loginOpen: false })
const listeners = new Set<(s: AppState) => void>()
function emit() { listeners.forEach(fn => fn(JSON.parse(JSON.stringify(local)))) }
export function previewQuota(percent: number) {
  const date = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 19)
  local.quota = normalizeQuota({ code: '000200', data: { dailyCostLimit: '300', currentDayCost: String(300 * (1 - percent / 100)), currentTime: date, lastCostEstimateTime: date, quotaExceeded: percent <= 0 } })
  local.status = quotaFreshness(local.quota); local.message = '演示数据 · 未连接真实账户'; emit()
}
const previewAPI: DesktopAPI = {
  async getState() { return JSON.parse(JSON.stringify(local)) },
  async login() { local.message = '请启动桌面应用，在官方窗口完成登录'; emit() },
  async logout() { local.quota = null; local.status = 'signed-out'; local.message = '演示已结束'; emit() },
  async refresh() { local.syncing = true; emit(); await new Promise(r => setTimeout(r, 600)); local.syncing = false; if (local.quota) previewQuota(local.quota.percent); else emit() },
  async settings(patch: Partial<Settings>) { Object.assign(local.settings, patch); emit() },
  async openSettings() { window.dispatchEvent(new CustomEvent('open-settings')) },
  async hide() { local.message = '桌面版可收起到系统托盘'; emit() },
  async quit() { local.message = '浏览器预览不会关闭标签页'; emit() },
  async openPortal() { window.open('https://aihub.eastmoney.com/personal', '_blank', 'noopener') },
  async openReleases() { window.open('https://github.com/wantwant123/em-use/releases', '_blank', 'noopener') },
  async screenshot() { return null },
  onState(callback) { listeners.add(callback); return () => listeners.delete(callback) },
}
export const api = window.emUse ?? previewAPI
export const appState = reactive<AppState>({ ...local })
api.onState(s => Object.assign(appState, s))
if (isDesktop) void api.getState().then(s => Object.assign(appState, s))
