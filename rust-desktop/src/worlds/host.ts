import { invoke, isTauri } from '@tauri-apps/api/core'
import './preview.css'

type SceneStats = { renderedFrames: number; simulationTime: number; loop: { running: boolean; paused: boolean } }
type WorldControl = { paused?: boolean; pointer?: [number, number] | null; feed?: number }
declare global {
  interface Window {
    sceneRate?: (fps: number) => void
    scenePause?: (paused: boolean) => void
    sceneFeed?: () => void
    sceneStats?: () => SceneStats
    worldHost?: (control: WorldControl) => void
  }
}
const native = isTauri(), token = new URLSearchParams(location.search).get('token') ?? ''
const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
let stopped = true, failed = false, disposed = false
let poll: ReturnType<typeof setInterval> | undefined
const report = async (kind: string, request?: number) => {
  if (native && !disposed) await invoke('world_event', { token, kind, request: request ?? null })
}
function pointer(point: [number, number] | null) {
  if (!point || stopped) { canvas.dispatchEvent(new PointerEvent('pointerleave')); return }
  const r = canvas.getBoundingClientRect()
  canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + point[0] * r.width, clientY: r.top + point[1] * r.height, bubbles: true }))
}
function control(value: WorldControl) {
  if (failed || disposed) return
  if (typeof value.paused === 'boolean') {
    stopped = value.paused
    window.scenePause?.(stopped)
    window.sceneRate?.(stopped ? 0 : 30)
    if (stopped) pointer(null)
  }
  if ('pointer' in value) pointer(value.pointer ?? null)
  if (value.feed !== undefined) {
    const accepted = !stopped && window.sceneStats?.().loop.running === true
    if (accepted) window.sceneFeed?.()
    void report(accepted ? 'fed' : 'feed-rejected', value.feed).catch(fail)
  }
}
function fail() {
  if (failed || disposed) return
  failed = true
  clearInterval(poll)
  window.scenePause?.(true)
  document.querySelector<HTMLElement>('#loading')!.hidden = true
  const error = document.querySelector<HTMLElement>('#error')!
  error.hidden = false
  error.textContent = '河床加载失败。请在桌面世界设置中重新加载；浏览器预览可刷新页面重试。'
  document.querySelectorAll<HTMLButtonElement>('.world-preview button').forEach(button => { button.disabled = true })
  void report('error').catch(() => {})
}
window.worldHost = control
window.addEventListener('error', fail)
window.addEventListener('unhandledrejection', fail)
canvas.addEventListener('webglcontextlost', fail)
// Wallpaper input belongs to Explorer. Only the host's sampled pointer is forwarded.
// Browser preview retains the upstream click-to-feed interaction.
if (native) canvas.addEventListener('pointerdown', event => event.stopImmediatePropagation(), true)

function previewControls() {
  const panel = document.createElement('aside')
  panel.className = 'world-preview'
  panel.setAttribute('aria-label', '河床预览控制')
  const label = document.createElement('span')
  label.textContent = '河床 · 浏览器预览（未设置系统壁纸）'
  const pause = document.createElement('button'), feed = document.createElement('button')
  pause.textContent = '暂停河床'; pause.setAttribute('aria-pressed', 'false')
  feed.textContent = '投喂鱼食'
  pause.onclick = () => {
    control({ paused: !stopped }); pause.textContent = stopped ? '继续河床' : '暂停河床'
    pause.setAttribute('aria-pressed', String(stopped)); feed.disabled = stopped
  }
  feed.onclick = () => control({ feed: 0 })
  panel.append(label, pause, feed); document.body.append(panel)
  // The preview toolbar is the single pause authority (no hidden upstream Space handler).
  document.addEventListener('keydown', event => {
    if (event.code === 'Space' && event.target === canvas) { event.preventDefault(); event.stopImmediatePropagation(); pause.click() }
  }, true)
}
async function start() {
  const entry = new URL('worlds/deskworlds/scenes/riverscape/src/main.js', document.baseURI).href
  await import(/* @vite-ignore */ entry)
  if (failed || disposed) return
  const started = performance.now()
  let initialized = false
  poll = setInterval(() => {
    if (failed || disposed) return
    if (!document.querySelector<HTMLElement>('#error')!.hidden || performance.now() - started > 45_000) { fail(); return }
    if (!initialized && window.sceneStats) {
      initialized = true
      if (native) void report('initialized').catch(fail)
      else { control({ paused: false }); previewControls() }
    }
    if (initialized && (window.sceneStats?.().renderedFrames ?? 0) > 0) {
      clearInterval(poll)
      void report('ready').catch(fail)
    }
  }, 100)
}
window.addEventListener('pagehide', () => {
  disposed = true; clearInterval(poll); window.scenePause?.(true); window.sceneRate?.(0)
  delete window.worldHost
}, { once: true })
void start().catch(fail)
