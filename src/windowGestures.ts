import { onUnmounted, ref } from 'vue'
import { api, isDesktop } from './bridge'
import type { WindowGesture } from './shared/windowGeometry'

export function useWindowGestures() {
  const moving = ref(false)
  let active: { pointer: number; x: number; y: number; host: HTMLElement; id: Promise<number>; mode: WindowGesture } | null = null
  let suppressUntil = 0, lastMove = 0
  function down(event: PointerEvent, mode: WindowGesture = 'move') {
    if (event.button === 0 && !active) suppressUntil = 0
    if (!isDesktop || event.button !== 0 || active) return
    const target = event.target as HTMLElement
    if (mode === 'move' && (target.closest('.is-wiping') || target.closest('button:not(.fish-hit):not(.scene-hit), input, a, .play-popover, .detail-popover, .play-hud, .buddy-panel, .buddy-hud'))) return
    active = { pointer: event.pointerId, x: event.screenX, y: event.screenY, host: event.currentTarget as HTMLElement, id: api.beginGesture(mode), mode }
    if (mode !== 'move') { event.preventDefault(); moving.value = true; active.host.setPointerCapture(event.pointerId) }
    active.id.catch(() => { moving.value = false; active = null })
  }
  function move(event: PointerEvent) {
    const current = active
    if (!current || event.pointerId !== current.pointer) return
    if (!moving.value && Math.hypot(event.screenX - current.x, event.screenY - current.y) < 5) return
    moving.value = true
    if (!current.host.hasPointerCapture(event.pointerId)) current.host.setPointerCapture(event.pointerId)
    event.preventDefault(); event.stopPropagation()
    if (performance.now() - lastMove < 16) return
    lastMove = performance.now()
    void current.id.then(id => { if (active === current) return api.moveGesture(id) }).catch(() => {})
  }
  function end() {
    const current = active
    if (!current) return
    const moved = moving.value
    if (moved) suppressUntil = performance.now() + 400
    active = null; moving.value = false
    if (current.host.hasPointerCapture(current.pointer)) current.host.releasePointerCapture(current.pointer)
    void current.id.then(async id => { if (moved) await api.moveGesture(id); await api.endGesture(id) }).catch(() => {})
  }
  function click(event: MouseEvent) {
    if (performance.now() < suppressUntil) { suppressUntil = 0; event.preventDefault(); event.stopImmediatePropagation() }
  }
  function wheel(event: WheelEvent) {
    if (!isDesktop || !(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    const width = (event.currentTarget as HTMLElement).getBoundingClientRect().width
    void api.settings({ windowWidth: Math.round(width * (event.deltaY < 0 ? 1.06 : .94)) })
  }
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); window.addEventListener('blur', end)
  onUnmounted(() => { end(); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('blur', end) })
  return { moving, down, move, end, click, wheel }
}
