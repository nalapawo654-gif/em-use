import { invoke, isTauri } from '@tauri-apps/api/core'
import { playIntro } from './player'
import './style.css'
const native = isTauri()
const film = document.querySelector<HTMLVideoElement>('#film')!
const intro = document.querySelector<HTMLElement>('#intro')!
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
let finishTimer: ReturnType<typeof setTimeout> | undefined
const notify = (kind: string) => native ? invoke('startup_event', { kind }) : Promise.resolve()
const dispose = playIntro({
  video: film, skip: document.querySelector('#skip')!, reduced,
  ready: () => { void notify('playing').catch(() => { void notify('finish').catch(() => {}) }) },
  finish: reason => {
    intro.classList.add('leaving')
    finishTimer = setTimeout(() => {
      dispose()
      if (native) void notify('finish').catch(() => {}) // Native watchdog handles broken IPC.
      else {
        intro.hidden = true
        const end = document.querySelector<HTMLElement>('#complete')!
        end.hidden = false
        end.dataset.reason = reason
        document.querySelector<HTMLButtonElement>('#replay')!.focus()
      }
    }, reduced ? 0 : 240)
  },
})
document.querySelector('#replay')!.addEventListener('click', () => location.reload())
window.addEventListener('pagehide', () => { clearTimeout(finishTimer); dispose() }, { once: true })
