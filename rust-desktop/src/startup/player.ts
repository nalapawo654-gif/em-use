export type FinishReason = 'ended' | 'skip' | 'error' | 'timeout' | 'hidden' | 'reduced-motion'
export interface IntroOptions {
  video: HTMLVideoElement
  skip: HTMLElement
  reduced: boolean
  ready: () => void
  finish: (reason: FinishReason) => void
  timeout?: number
}
// This player owns every listener and timer and releases the decoder on ALL exit paths.
export function playIntro({ video, skip, reduced, ready, finish, timeout = 4400 }: IntroOptions) {
  let closed = false, presented = false
  const off: (() => void)[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  function listen(target: EventTarget, event: string, handler: EventListener) {
    target.addEventListener(event, handler)
    off.push(() => target.removeEventListener(event, handler))
  }
  function dispose() {
    closed = true
    clearTimeout(timer)
    off.splice(0).forEach(fn => fn())
    video.pause()
    video.removeAttribute('src')
    video.querySelectorAll('source').forEach(source => source.removeAttribute('src'))
    video.load()
  }
  function stop(reason: FinishReason) {
    if (closed) return
    // Keep the final frame until the short fade completes. Decoding is stopped now.
    closed = true
    clearTimeout(timer)
    off.splice(0).forEach(fn => fn())
    video.pause()
    finish(reason)
  }
  if (reduced) {
    stop('reduced-motion')
    dispose()
    return dispose
  }
  listen(video, 'loadeddata', () => { if (!presented && !closed) { presented = true; ready() } })
  listen(video, 'ended', () => stop('ended'))
  listen(video, 'error', () => stop('error'))
  // A failed <source> does not reliably bubble a video error.
  video.querySelectorAll('source').forEach(source => listen(source, 'error', () => stop('error')))
  listen(skip, 'click', () => stop('skip'))
  listen(window, 'keydown', (event) => { if ((event as KeyboardEvent).key === 'Escape') stop('skip') })
  // Ignore the initially hidden native window; once shown, leaving it skips the intro.
  let wasVisible = document.visibilityState === 'visible'
  listen(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') wasVisible = true
    else if (wasVisible) stop('hidden')
  })
  timer = setTimeout(() => stop('timeout'), timeout)
  video.muted = true
  video.load()
  void video.play().catch(() => stop('error'))
  return dispose
}
