import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advanceBuddy, beginBuddy, buddyCleanCells, buddyIdle, buddyLevel, scrubBuddy, durations } from '../src/buddy/play.ts'
import { validateSettings } from '../src/shared/settings.ts'
import { DEFAULT_SETTINGS } from '../src/shared/types.ts'

test('quota levels distinguish exhausted, low, tired and full without inventing missing quota', () => {
  assert.deepEqual([100, 61, 60, 26, 25, 1, 0, -1].map(buddyLevel), [0, 0, 1, 1, 2, 2, 3, 3])
  assert.equal(buddyLevel(null), 0); assert.equal(buddyLevel(NaN), 0)
})
test('every timed action ends, and replacing an action cancels its old schedule', () => {
  for (const [mode, duration] of Object.entries(durations)) {
    const state = beginBuddy(mode as keyof typeof durations, 100)
    assert.equal(advanceBuddy(state, 100 + duration - 1).mode, mode)
    assert.equal(advanceBuddy(state, 100 + duration).mode, 'idle')
    assert.equal(advanceBuddy(state, 1900, true).mode, 'idle')
  }
  const replacement = beginBuddy('drink', 5000)
  assert.equal(advanceBuddy(replacement, 5100).mode, 'drink')
  assert.equal(advanceBuddy(beginBuddy('clean', 0), 100000).mode, 'clean')
})
test('cleaning requires covering the animal, then celebrates and returns to idle', () => {
  let state = beginBuddy('clean', 0)
  for (let i = 0; i < 100; i++) state = scrubBuddy(state, .4, .4, i)
  assert.equal(state.mode, 'clean'); assert.ok(state.cleaned.length < 18)
  assert.equal(scrubBuddy(state, NaN, 0, 100), state)
  for (const p of buddyCleanCells) state = scrubBuddy(state, p.x, p.y, 200)
  assert.equal(state.mode, 'celebrate')
  assert.equal(advanceBuddy(state, 2300).mode, 'idle')
  assert.deepEqual(scrubBuddy(buddyIdle(), .4, .4, 0), buddyIdle())
})
test('old settings keep the aquarium and new scene and skin choices survive validation', () => {
  const old = { ...DEFAULT_SETTINGS, ...validateSettings({ outfit: 'royal', theme: 'night', size: 'mini' }) }
  assert.equal(old.scene, 'aquarium'); assert.equal(old.buddySkin, 'classic'); assert.equal(old.outfit, 'royal')
  assert.deepEqual(validateSettings({ scene: 'buddy', buddySkin: 'holiday', outfit: 'sailor' }), { scene: 'buddy', buddySkin: 'holiday', outfit: 'sailor' })
  assert.deepEqual(validateSettings({ scene: 'unknown', buddySkin: 'unknown', reducedMotion: 'true', windowWidth: NaN, auth: 'not-a-setting' }), {})
  assert.deepEqual(validateSettings({ windowWidth: 999, clickThrough: true }), { windowWidth: 800, clickThrough: true })
})
