import { contextBridge, ipcRenderer } from 'electron'
const api = {
  getState: () => ipcRenderer.invoke('state:get'),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  refresh: () => ipcRenderer.invoke('quota:refresh'),
  settings: (patch: unknown) => ipcRenderer.invoke('settings:set', patch),
  openSettings: () => ipcRenderer.invoke('window:settings'),
  hide: () => ipcRenderer.invoke('window:hide'),
  quit: () => ipcRenderer.invoke('app:quit'),
  openPortal: () => ipcRenderer.invoke('portal:open'),
  openReleases: () => ipcRenderer.invoke('releases:open'),
  screenshot: () => ipcRenderer.invoke('window:screenshot'),
  onState: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state)
    ipcRenderer.on('state:changed', listener)
    return () => ipcRenderer.removeListener('state:changed', listener)
  },
}
contextBridge.exposeInMainWorld('emUse', api)
