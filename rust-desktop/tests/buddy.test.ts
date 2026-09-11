import { sampleBuddyMotion } from '../src/buddy/motion.ts'
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
  assert.equal(advanceBuddy(state, state.since + durations.celebrate).mode, 'idle')
  assert.deepEqual(scrubBuddy(buddyIdle(), .4, .4, 0), buddyIdle())
})
test('old settings keep the aquarium and new scene and skin choices survive validation', () => {
  const old = { ...DEFAULT_SETTINGS, ...validateSettings({ outfit: 'royal', theme: 'night', size: 'mini' }) }
  assert.equal(old.scene, 'aquarium'); assert.equal(old.buddySkin, 'classic'); assert.equal(old.outfit, 'royal')
  assert.deepEqual(validateSettings({ scene: 'buddy', buddySkin: 'holiday', outfit: 'sailor' }), { scene: 'buddy', buddySkin: 'holiday', outfit: 'sailor' })
  assert.deepEqual(validateSettings({ scene: 'unknown', buddySkin: 'unknown', reducedMotion: 'true', windowWidth: NaN, auth: 'not-a-setting' }), {})
  assert.deepEqual(validateSettings({ windowWidth: 999, clickThrough: true }), { windowWidth: 800, clickThrough: true })
})

// Motion is sampled deterministically: verify the mouth, target and recovery,
// rather than checking that a CSS class happens to exist.
test('feeding and drinking articulate the head and mouth then recover', () => {
  for (const action of ['feed', 'drink'] as const) {
    const start = sampleBuddyMotion(action, 0, 1000, 0)
    const active = sampleBuddyMotion(action, 1800, 2800, 0)
    const later = sampleBuddyMotion(action, 1970, 2970, 0)
    const end = sampleBuddyMotion(action, durations[action], 7000, 0)
    assert.equal(start.phase, 'prepare')
    assert.equal(active.phase, 'perform')
    assert.ok(active.headAngle < -.3)
    assert.ok(active.headY > 20)
    assert.ok(Math.abs(active.mouth - later.mouth) > .02)
    assert.equal(end.phase, 'recover')
    assert.ok(Math.abs(end.headAngle) < .02)
  }
})
test('swatting turns attention to the mosquito, lashes the tail then lets it escape', () => {
  const look = sampleBuddyMotion('swat', 1500, 1500, 0)
  const strike = sampleBuddyMotion('swat', 2300, 2300, 0)
  const escaped = sampleBuddyMotion('swat', 4600, 4600, 0)
  assert.equal(look.expression, 'annoyed')
  assert.ok(look.lookX > 2)
  assert.ok(strike.tailAngle < -.7)
  assert.equal(escaped.bugAlpha, 0)
  assert.equal(escaped.expression, 'happy')
})
test('reduced motion holds body parts still and sleeping closes the eyes', () => {
  for (const action of ['feed','drink','pet','play','swat','sleep','shake'] as const) {
    const frame = sampleBuddyMotion(action, 1800, 1800, 0, true)
    assert.equal(frame.headAngle, 0)
    assert.equal(frame.tailAngle, 0)
    assert.equal(frame.foot, 0)
  }
  assert.equal(sampleBuddyMotion('sleep', 2000, 2000, 0).eyeOpen, 0)
})
