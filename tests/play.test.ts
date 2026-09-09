import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advancePlay, cleanCells, idlePlay, startPlay, waterTop, wipeAt } from '../src/aquarium/play.ts'

test('quota only controls a monotonic waterline and zero really reaches the floor', () => {
  assert.equal(waterTop(0), .84)
  assert.equal(waterTop(-1), waterTop(0)); assert.equal(waterTop(101), waterTop(100))
  for (let p = 1; p <= 100; p++) assert.ok(waterTop(p) < waterTop(p - 1))
  assert.ok(Number.isFinite(waterTop(null))); assert.ok(Number.isFinite(waterTop(NaN)))
})
test('hide and seek always exits, even if no one finds the fish', () => {
  let state = advancePlay(startPlay('hide', 100), 1200)
  assert.equal(state.mode, 'seek')
  state = advancePlay(state, 13200); assert.equal(state.mode, 'reveal')
  state = advancePlay(state, 14700); assert.equal(state.mode, 'idle')
})
test('starting a new activity replaces the old schedule instead of finishing it later', () => {
  let state = startPlay('treasure', 0)
  state = startPlay('clean', 100)
  assert.equal(advancePlay(state, 100000).mode, 'clean')
  state = idlePlay(); assert.equal(advancePlay(state, 200000).mode, 'idle')
})
test('scrubbing the same spot cannot complete cleaning', () => {
  let state = startPlay('clean', 0)
  for (let i = 0; i < 100; i++) state = wipeAt(state, .5, .5, i)
  assert.equal(state.mode, 'clean'); assert.ok(state.cleaned.length < 10)
  assert.equal(wipeAt(state, NaN, .5, 101), state)
})
test('covering the glass finishes cleaning and the celebration recovers to idle', () => {
  let state = startPlay('clean', 0)
  for (const p of cleanCells) state = wipeAt(state, p.x, p.y, 100)
  assert.equal(state.mode, 'celebrate')
  assert.equal(advancePlay(state, 1900).mode, 'idle')
  assert.equal(wipeAt(idlePlay(), .5, .5, 2000).mode, 'idle')
})
test('feeding and treasure recover without timers surviving a replaced activity', () => {
  assert.equal(advancePlay(startPlay('feed', 0), 2800).mode, 'idle')
  assert.equal(advancePlay(startPlay('treasure', 0), 6500).mode, 'idle')
})
