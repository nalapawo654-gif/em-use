import { SCENE_LABELS } from '../src/shared/types.js'
import { app, BrowserWindow, ipcMain, session, net, Tray, Menu, nativeImage, screen, powerMonitor, Notification, shell, dialog } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'
import type { AppState, Settings } from '../src/shared/types.js'
import { DEFAULT_SETTINGS } from '../src/shared/types.js'
import { captureHeaders, QUOTA_URL, PORTAL_URL, normalizeQuota, quotaFreshness, QuotaError, millisecondsToMidnight, type AuthHeaders } from '../src/shared/quota.js'
import { fitBowl, gestureBounds, PRESET_WIDTHS, type Bounds, type WindowGesture } from '../src/shared/windowGeometry.js'
import { readCredentials, saveCredentials, clearCredentials, readSettings, saveSettings, validateSettings, readPosition, savePosition } from './storage.js'

const here = dirname(fileURLToPath(import.meta.url))
const rendererFile = join(here, '../../dist/index.html')
const devURL = !app.isPackaged ? process.env.EM_USE_DEV_URL : undefined
let widget: BrowserWindow | null = null, settingsWindow: BrowserWindow | null = null, loginWindow: BrowserWindow | null = null
let tray: Tray | null = null, quitting = false, suspended = false
let headers: AuthHeaders | null = null, generation = 0, requestAbort: AbortController | null = null
let lastRefresh = 0, failures = 0, nextAttempt = 0, pendingCandidate = ''
const notified = new Set<string>()
let timer: NodeJS.Timeout | undefined, midnightTimer: NodeJS.Timeout | undefined
let state: AppState = { status: 'signed-out', quota: null, message: '登录后，让小伙伴陪你看额度', syncing: false, settings: { ...DEFAULT_SETTINGS }, version: app.getVersion(), persistentLogin: false, loginOpen: false }
const sceneTitle = () => SCENE_LABELS[state.settings.scene]

if (process.env.EM_USE_DATA_DIR && !app.isPackaged) app.setPath('userData', process.env.EM_USE_DATA_DIR)
const single = app.requestSingleInstanceLock()
if (!single) app.quit()
else {
  app.on('second-instance', () => { widget?.show(); widget?.focus() })
  app.whenReady().then(start).catch(() => { dialog.showErrorBox('EM Use 启动失败', '应用暂时无法启动，请重新打开。'); app.quit() })
}
function publish() {
  for (const win of [widget, settingsWindow]) if (win && !win.isDestroyed()) win.webContents.send('state:changed', structuredClone(state))
  if (tray) { tray.setToolTip(state.quota ? `EM Use · 剩余 ¥${state.quota.remaining.toFixed(2)} · ${state.message}` : `EM Use · ${sceneTitle()}`); updateTray() }
}
function showMessage(status: AppState['status'], message: string) { state.status = status; state.message = message; publish() }
function reconcile() {
  if (!headers || !state.quota || ['expired', 'forbidden', 'unavailable'].includes(state.status)) return
  const fresh = quotaFreshness(state.quota)
  if (failures > 0 && fresh !== 'resetting') { state.status = 'stale'; return }
  state.status = fresh
  state.message = fresh === 'ready' ? '额度已同步，小伙伴状态不错' : fresh === 'resetting' ? '正在同步今日额度，请稍候' : '费用数据更新较慢，当前为上次结果'
}
async function fetchQuota(auth: AuthHeaders, signal: AbortSignal) {
  const response = await net.fetch(QUOTA_URL, { method: 'GET', headers: auth, credentials: 'omit', redirect: 'error', signal, cache: 'no-store' })
  if (response.status === 401) throw new QuotaError('expired', '登录已过期，请重新登录')
  if (response.status === 403) throw new QuotaError('forbidden', '当前账号暂无个人额度访问权限')
  if (!response.ok) throw new QuotaError('network', response.status === 429 ? '查询较频繁，稍后自动重试' : '平台暂时不可用，稍后自动重试')
  return normalizeQuota(await response.json())
}
async function refresh(force = false) {
  if (!headers || state.syncing || suspended || Date.now() - lastRefresh < 3000 || (!force && Date.now() < nextAttempt)) return
  const ticket = generation, auth = { ...headers }
  lastRefresh = Date.now(); state.syncing = true; publish()
  const controller = new AbortController(); requestAbort = controller
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const quota = await fetchQuota(auth, controller.signal)
    if (ticket !== generation) return
    state.quota = quota; state.status = 'ready'; failures = 0; nextAttempt = Date.now() + 60_000
    reconcile(); maybeNotify()
  } catch (error) {
    if (ticket !== generation) return
    failures++; nextAttempt = Date.now() + Math.min(300_000, 30_000 * 2 ** Math.min(failures, 4))
    if (error instanceof QuotaError && error.kind === 'expired') {
      headers = null; clearCredentials(); state.persistentLogin = false; state.status = 'expired'; state.message = error.message
    } else if (error instanceof QuotaError && ['forbidden', 'unavailable'].includes(error.kind)) {
      state.status = error.kind as 'forbidden' | 'unavailable'; state.message = error.message
    } else { state.status = 'stale'; state.message = error instanceof QuotaError ? error.message : '暂时连接不上，恢复网络后自动同步' }
  } finally {
    clearTimeout(timeout)
    if (ticket === generation) { state.syncing = false; requestAbort = null; publish() }
  }
}
function maybeNotify() {
  const q = state.quota
  if (!q || state.status !== 'ready' || q.percent > 30 || !state.settings.notifications) return
  const key = `${q.day}:${q.percent <= 10 ? 'danger' : 'warning'}`
  if (notified.has(key)) return
  notified.add(key)
  if (q.percent <= 10) notified.add(`${q.day}:warning`)
  for (const prior of notified) if (!prior.startsWith(q.day)) notified.delete(prior)
  if (Notification.isSupported()) new Notification({ title: q.percent <= 10 ? '今日额度不多了' : `${sceneTitle()}提醒你留意额度`, body: `剩余 ¥${q.remaining.toFixed(2)}，每日 00:00 重置。`, silent: true }).show()
}
async function openLogin() {
  if (loginWindow) { loginWindow.show(); loginWindow.focus(); return }
  state.loginOpen = true
  if (!state.quota) state.status = 'connecting'
  state.message = '请在官方窗口完成登录'; publish()
  const authSession = session.fromPartition('em-use-auth') // In-memory browser session; only verified headers are encrypted to disk.
  loginWindow = new BrowserWindow({ width: 1020, height: 760, minWidth: 760, minHeight: 620, title: '登录 AI 云平台 · EM Use', backgroundColor: '#f1f7fb', autoHideMenuBar: true, webPreferences: { session: authSession, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } })
  authSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  authSession.setPermissionCheckHandler(() => false)
  authSession.webRequest.onSendHeaders({ urls: ['https://aihub.eastmoney.com/ai-cloud-hub/*'] }, details => {
    if (!loginWindow || details.webContentsId !== loginWindow.webContents.id) return
    const candidate = captureHeaders(details.requestHeaders)
    if (candidate) void acceptCandidate(candidate)
  })
  const allowed = (url: string) => { try { const u = new URL(url); return u.protocol === 'https:' && ['aihub.eastmoney.com', 'dongdong-auth.eastmoney.com'].includes(u.hostname) } catch { return false } }
  loginWindow.webContents.on('will-navigate', (event, url) => { if (!allowed(url)) event.preventDefault() })
  loginWindow.webContents.setWindowOpenHandler(({ url }) => { if (allowed(url)) void loginWindow?.loadURL(url); return { action: 'deny' } })
  loginWindow.on('closed', () => {
    loginWindow = null; state.loginOpen = false; pendingCandidate = ''
    authSession.webRequest.onSendHeaders(null)
    if (state.status === 'connecting') { state.status = 'signed-out'; state.message = '登录未完成，随时可以继续' }
    publish()
  })
  void loginWindow.loadURL(PORTAL_URL).catch(() => { state.message = '登录页连接失败，请检查网络后重新打开'; publish() })
}
async function acceptCandidate(candidate: AuthHeaders) {
  const key = AUTH_KEYS_STRING(candidate)
  if (pendingCandidate === key) return
  pendingCandidate = key
  const ticket = ++generation; requestAbort?.abort(); state.syncing = true; publish()
  const controller = new AbortController(); requestAbort = controller
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const quota = await fetchQuota(candidate, controller.signal)
    if (ticket !== generation || !loginWindow) return
    headers = candidate; state.persistentLogin = saveCredentials(candidate)
    state.quota = quota; state.status = 'ready'; failures = 0; notified.clear(); nextAttempt = Date.now() + 60_000
    reconcile(); loginWindow.close(); widget?.show()
  } catch (error) {
    if (ticket !== generation) return
    state.message = error instanceof QuotaError ? error.message : '登录信息已获取，额度验证失败，请稍后重新打开登录'
    state.status = error instanceof QuotaError && error.kind === 'forbidden' ? 'forbidden' : state.quota ? 'stale' : 'connecting'
    pendingCandidate = ''
  } finally { clearTimeout(timeout); if (ticket === generation) { state.syncing = false; requestAbort = null; publish() } }
}
function AUTH_KEYS_STRING(a: AuthHeaders) { return `${a['X-Dong-User']}:${a['X-Dong-Client']}:${a['X-Dong-Auth']}` }
async function logout() {
  generation++; requestAbort?.abort(); loginWindow?.close(); pendingCandidate = ''; headers = null
  clearCredentials(); await session.fromPartition('em-use-auth').clearStorageData()
  state = { ...state, status: 'signed-out', quota: null, message: '已退出登录', syncing: false, persistentLogin: false, loginOpen: false }; publish()
}
let gesture: { id: number; mode: WindowGesture; bounds: Bounds; cursor: { x: number; y: number } } | null = null
let gestureCounter = 0, gestureTimeout: NodeJS.Timeout | undefined
function finishGesture(id: number) {
  if (!gesture || gesture.id !== id) return
  gesture = null; clearTimeout(gestureTimeout)
  if (widget && !widget.isDestroyed()) {
    const b = widget.getBounds(); state.settings.windowWidth = b.width
    savePosition(b.x, b.y); saveSettings(state.settings); publish()
  }
}
function moveGesture(id: number) {
  if (!gesture || gesture.id !== id || !widget) return
  const cursor = screen.getCursorScreenPoint()
  const area = gesture.mode === 'move' ? screen.getDisplayNearestPoint(cursor).workArea : screen.getDisplayMatching(gesture.bounds).workArea
  widget.setBounds(gestureBounds(gesture.bounds, cursor.x - gesture.cursor.x, cursor.y - gesture.cursor.y, gesture.mode, area))
}
function windowOptions() { return { preload: join(here, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } }
async function loadRenderer(win: BrowserWindow, page: string) {
  if (devURL) await win.loadURL(`${devURL}/?view=${page}`)
  else await win.loadFile(rendererFile, { query: { view: page } })
}
function keepOnScreen() {
  if (!widget) return
  const b = widget.getBounds(), area = screen.getDisplayMatching(b).workArea
  widget.setBounds(fitBowl(b, area))
}
function createWidget() {
  const width = state.settings.windowWidth, height = width, area = screen.getPrimaryDisplay().workArea, saved = readPosition()
  widget = new BrowserWindow({ width, height, x: saved?.x ?? area.x + area.width - width - 32, y: saved?.y ?? area.y + 60, frame: false, transparent: true, resizable: false, hasShadow: false, alwaysOnTop: state.settings.alwaysOnTop, skipTaskbar: true, show: false, title: `EM Use · ${sceneTitle()}`, webPreferences: windowOptions() })
  keepOnScreen(); state.settings.windowWidth = widget.getBounds().width; widget.setIgnoreMouseEvents(state.settings.clickThrough, { forward: true })
  widget.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  widget.webContents.on('will-navigate', e => e.preventDefault())
  widget.on('ready-to-show', () => widget?.showInactive())
  widget.on('close', e => { if (!quitting) { e.preventDefault(); widget?.hide() } })
  widget.on('blur', () => { if (gesture) finishGesture(gesture.id) })
  widget.on('hide', () => { if (gesture) finishGesture(gesture.id) })
  widget.on('moved', () => { if (widget && !gesture) { const [x, y] = widget.getPosition(); savePosition(x, y) } })
  void loadRenderer(widget, 'widget')
}
function openSettings() {
  if (settingsWindow) { settingsWindow.show(); settingsWindow.focus(); return }
  settingsWindow = new BrowserWindow({ width: 880, height: 680, minWidth: 780, minHeight: 620, title: '桌面小伙伴设置 · EM Use', backgroundColor: '#f2f8fc', autoHideMenuBar: true, webPreferences: windowOptions() })
  settingsWindow.on('closed', () => { settingsWindow = null })
  settingsWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  settingsWindow.webContents.on('will-navigate', e => e.preventDefault())
  void loadRenderer(settingsWindow, 'settings')
}
function applySettings(patch: unknown) {
  const valid = validateSettings(patch)
  state.settings = { ...state.settings, ...valid }
  widget?.setAlwaysOnTop(state.settings.alwaysOnTop)
  widget?.setIgnoreMouseEvents(state.settings.clickThrough, { forward: true })
  if ('size' in valid || 'windowWidth' in valid) {
    if (gesture) finishGesture(gesture.id)
    const w = valid.windowWidth ?? PRESET_WIDTHS[state.settings.size]
    widget?.setSize(w, w); keepOnScreen(); state.settings.windowWidth = widget?.getBounds().width ?? w
  }
  if ('launchAtLogin' in valid) {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: state.settings.launchAtLogin })
    else state.settings.launchAtLogin = false
  }
  saveSettings(state.settings); publish()
}
function updateTray() {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: `显示${sceneTitle()}`, click: () => { widget?.show(); widget?.focus() } },
    { label: '陪伴场景', submenu: [
      { label: '额度小鱼缸', type: 'radio', checked: state.settings.scene === 'aquarium', click: () => applySettings({ scene: 'aquarium' }) },
      { label: '充气牛马', type: 'radio', checked: state.settings.scene === 'buddy', click: () => applySettings({ scene: 'buddy' }) },
      { label: '林间海狸鼠', type: 'radio', checked: state.settings.scene === 'beaver', click: () => applySettings({ scene: 'beaver' }) },
      { label: '修仙渡劫事务所', type: 'radio', checked: state.settings.scene === 'cultivation', click: () => applySettings({ scene: 'cultivation' }) },
      { label: '健身电池人', type: 'radio', checked: state.settings.scene === 'battery', click: () => applySettings({ scene: 'battery' }) },
      { label: '仓鼠动力机房', type: 'radio', checked: state.settings.scene === 'hamster', click: () => applySettings({ scene: 'hamster' }) },
    ] },
    { label: '刷新额度', enabled: !!headers && !state.syncing, click: () => { void refresh(true) } },
    { label: '设置', click: openSettings }, { type: 'separator' },
    { label: '置顶显示', type: 'checkbox', checked: state.settings.alwaysOnTop, click: item => applySettings({ alwaysOnTop: item.checked }) },
    { label: '鼠标穿透', type: 'checkbox', checked: state.settings.clickThrough, click: item => applySettings({ clickThrough: item.checked }) },
    { label: '登录 AI 云平台', click: () => { void openLogin() } },
    { type: 'separator' }, { label: '退出 EM Use', click: () => app.quit() },
  ]))
}
function setupIPC() {
  const handle = (channel: string, fn: (...args: any[]) => unknown, widgetOnly = false) => ipcMain.handle(channel, (event, ...args) => {
    if (![widget?.webContents.id, settingsWindow?.webContents.id].includes(event.sender.id) || event.senderFrame !== event.sender.mainFrame) throw new Error('Untrusted sender')
    if (widgetOnly && event.sender.id !== widget?.webContents.id) throw new Error('Widget only')
    const url = event.senderFrame?.url ?? ''
    if (devURL ? !url.startsWith(`${devURL}/`) : !url.startsWith(pathToFileURL(rendererFile).href)) throw new Error('Untrusted origin')
    return fn(...args)
  })
  handle('state:get', () => structuredClone(state)); handle('auth:login', openLogin); handle('auth:logout', logout)
  handle('quota:refresh', () => refresh(true)); handle('settings:set', applySettings)
  handle('window:gesture-start', (mode: unknown) => {
    if (!widget || (typeof mode !== 'string' || !['move', 'nw', 'ne', 'sw', 'se'].includes(mode))) throw new Error('Invalid gesture')
    if (gesture) finishGesture(gesture.id)
    gesture = { id: ++gestureCounter, mode: mode as WindowGesture, bounds: widget.getBounds(), cursor: screen.getCursorScreenPoint() }
    gestureTimeout = setTimeout(() => { if (gesture) finishGesture(gesture.id) }, 30_000)
    return gesture.id
  }, true)
  handle('window:gesture-move', moveGesture, true)
  handle('window:gesture-end', finishGesture, true)
  handle('window:settings', openSettings); handle('window:hide', () => widget?.hide()); handle('app:quit', () => app.quit())
  handle('portal:open', openLogin)
  handle('releases:open', () => shell.openExternal('https://github.com/wantwant123/em-use/releases'))
  handle('window:screenshot', async () => {
    if (!widget) return null
    const result = await dialog.showSaveDialog(widget, { defaultPath: `EM-Use-${new Date().toISOString().slice(0, 10)}.png`, filters: [{ name: 'PNG', extensions: ['png'] }] })
    if (result.canceled || !result.filePath) return null
    const image = await widget.webContents.capturePage(); await writeFile(result.filePath, image.toPNG()); return result.filePath
  })
}
function scheduleMidnight() {
  clearTimeout(midnightTimer)
  midnightTimer = setTimeout(() => { reconcile(); publish(); void refresh(true); scheduleMidnight() }, Math.max(1000, millisecondsToMidnight() + 1000))
}
async function start() {
  app.setName('EM Use'); state.settings = readSettings(); headers = readCredentials(); state.persistentLogin = !!headers
  // Always start interactive so a stale click-through preference cannot strand the user.
  state.settings.clickThrough = false
  setupIPC(); createWidget()
  const iconPath = app.isPackaged ? join(process.resourcesPath, 'tray.png') : join(here, '../../public/assets/clownfish.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 })
  tray = new Tray(icon); tray.on('click', () => { widget?.show(); widget?.focus() }); updateTray()
  if (headers) { state.status = 'connecting'; state.message = '正在同步今日额度'; void refresh(true) }
  timer = setInterval(() => { if (suspended) return; reconcile(); publish(); void refresh() }, 15000)
  scheduleMidnight()
  powerMonitor.on('suspend', () => { suspended = true; requestAbort?.abort() })
  powerMonitor.on('resume', () => { suspended = false; nextAttempt = 0; scheduleMidnight(); void refresh(true) })
  screen.on('display-removed', keepOnScreen); screen.on('display-metrics-changed', keepOnScreen)
  app.on('activate', () => { widget?.show(); widget?.focus() })
}
app.on('window-all-closed', () => { /* Tray keeps the app available. */ })
app.on('before-quit', () => { quitting = true; clearInterval(timer); clearTimeout(midnightTimer); requestAbort?.abort(); tray?.destroy() })
