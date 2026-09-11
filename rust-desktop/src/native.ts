import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AppState, DesktopAPI } from './shared/types'
export async function installNativeBridge() {
  if (!isTauri() || window.emUse) return
  const callbacks = new Set<(s: AppState) => void>()
  const call = <T = void>(action: string, payload?: unknown) => invoke<T>('desktop', { action, payload: payload ?? null })
  // Subscribe before mounting App, so an initial snapshot cannot leave a missed event.
  await listen<AppState>('state:changed', event => callbacks.forEach(fn => fn(event.payload)))
  const api: DesktopAPI = {
    getState: () => call<AppState>('getState'), login: mode => call('login', mode), logout: () => call('logout'),
    refresh: () => call('refresh'), settings: patch => call('settings', patch),
    beginGesture: mode => call<number>('beginGesture', mode), moveGesture: id => call('moveGesture', id), endGesture: id => call('endGesture', id),
    openSettings: () => call('openSettings'), hide: () => call('hide'), quit: () => call('quit'),
    openPortal: () => call('openPortal'), openReleases: () => call('openReleases'),
    checkUpdate: () => invoke('check_update'), installUpdate: () => invoke('install_update'),
    async screenshot() {
      const { toPng } = await import('html-to-image')
      const url = await toPng(document.querySelector<HTMLElement>('#app')!, { pixelRatio: devicePixelRatio, cacheBust: false })
      return call<string | null>('screenshot', url.split(',')[1])
    },
    onState(fn) { callbacks.add(fn); return () => { callbacks.delete(fn) } },
  }
  window.emUse = api
}
