import test from 'node:test'
import assert from 'node:assert/strict'
import { playIntro } from '../src/startup/player'
import { DEFAULT_SETTINGS } from '../src/shared/types'
import { validateSettings } from '../src/shared/settings'

function fixture() {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: 'hidden' })
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true })
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true })
  let pauses = 0, loads = 0, removed = false, sourceRemoved = false
  const source = Object.assign(new EventTarget(), { removeAttribute() { sourceRemoved = true } })
  const video = Object.assign(new EventTarget(), {
    muted: false, play: () => Promise.resolve(), pause() { pauses++ }, load() { loads++ },
    removeAttribute() { removed = true }, querySelectorAll() { return [source] },
  })
  const skip = new EventTarget(), reasons: string[] = []
  let ready = 0
  const options = { video: video as unknown as HTMLVideoElement, skip: skip as unknown as HTMLElement,
    reduced: false, ready: () => ready++, finish: (reason: string) => reasons.push(reason) }
  return { video, source, win, doc, skip, options, reasons, ready: () => ready,
    released: () => removed && sourceRemoved && pauses > 0 && loads > 1,
    restore() {
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window')
      if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document')
    } }
}
test('startup defaults migrate old settings and reject non-boolean values', () => {
  const s = { ...DEFAULT_SETTINGS, ...validateSettings({ scene: 'potato' }) }
  assert.equal(s.startupAnimation, true)
  assert.equal(s.scene, 'potato')
  assert.deepEqual(validateSettings({ startupAnimation: false }), { startupAnimation: false })
  assert.deepEqual(validateSettings({ startupAnimation: 'false' }), {})
})
test('intro presents once, completes once, and releases its media sources', () => {
  const f = fixture()
  try {
    const dispose = playIntro(f.options)
    f.video.dispatchEvent(new Event('loadeddata')); f.video.dispatchEvent(new Event('loadeddata'))
    assert.equal(f.ready(), 1)
    f.video.dispatchEvent(new Event('ended')); f.skip.dispatchEvent(new Event('click'))
    assert.deepEqual(f.reasons, ['ended'])
    dispose()
    assert.equal(f.released(), true)
  } finally { f.restore() }
})
test('skip, Escape, and source failure each finish cleanly and ignore late media events', () => {
  for (const action of ['click', 'Escape', 'error']) {
    const f = fixture()
    try {
      const dispose = playIntro(f.options)
      if (action === 'click') f.skip.dispatchEvent(new Event('click'))
      else if (action === 'error') f.source.dispatchEvent(new Event('error'))
      else f.win.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }))
      f.video.dispatchEvent(new Event('loadeddata')); f.video.dispatchEvent(new Event('ended'))
      assert.equal(f.ready(), 0)
      assert.deepEqual(f.reasons, [action === 'error' ? 'error' : 'skip'])
      dispose(); assert.equal(f.released(), true)
    } finally { f.restore() }
  }
})
test('hidden native window can initialize, but hiding after presentation exits', () => {
  const f = fixture()
  try {
    const dispose = playIntro(f.options)
    f.doc.dispatchEvent(new Event('visibilitychange'))
    assert.deepEqual(f.reasons, [])
    f.doc.visibilityState = 'visible'; f.doc.dispatchEvent(new Event('visibilitychange'))
    f.doc.visibilityState = 'hidden'; f.doc.dispatchEvent(new Event('visibilitychange'))
    assert.deepEqual(f.reasons, ['hidden'])
    dispose()
  } finally { f.restore() }
})
test('reduced motion skips playback; missing media events hit a bounded timeout', async () => {
  const f = fixture()
  try {
    const dispose = playIntro({ ...f.options, reduced: true })
    assert.deepEqual(f.reasons, ['reduced-motion']); dispose()
    f.reasons.length = 0
    const stop = playIntro({ ...f.options, timeout: 10 })
    await new Promise(resolve => setTimeout(resolve, 25))
    assert.deepEqual(f.reasons, ['timeout']); stop()
    assert.equal(f.released(), true)
  } finally { f.restore() }
})
