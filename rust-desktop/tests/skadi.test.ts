import test from 'node:test'
import assert from 'node:assert/strict'
import { SKADI_ACTIONS, advanceSkadi, beginSkadi, skadiIdle, skadiLevel, skadiFrame } from '../src/skadi/play'
import { SKADI_SKINS, DEFAULT_SETTINGS } from '../src/shared/types'
import { validateSettings } from '../src/shared/settings'
import { skadiMatte } from '../src/skadi/sprites'

test('unknown quota never becomes exhausted or full; every threshold is covered', () => {
  assert.deepEqual([100,61,60,21,20,16,0,-1,null,NaN,Infinity].map(skadiLevel), ['full','full','medium','medium','low','low','empty','empty','unknown','unknown','unknown'])
})
test('temporary actions expire at their boundary; work and sleep require explicit exit', () => {
  for (const action of SKADI_ACTIONS) {
    const play = beginSkadi(action.id, 100)
    if (action.duration === null) assert.equal(advanceSkadi(play, 1e9), play)
    else {
      assert.equal(advanceSkadi(play, 99 + action.duration), play)
      assert.deepEqual(advanceSkadi(play, 100 + action.duration), skadiIdle())
    }
  }
  assert.deepEqual(beginSkadi('idle', 1e9), skadiIdle())
})
test('replacement action owns its timer and returns to the current quota posture', () => {
  const next = beginSkadi('sing', 2900)
  assert.equal(advanceSkadi(next, 3100).action, 'sing')
  const ended = advanceSkadi(next, 9000)
  assert.equal(skadiFrame(ended.action, 0), 5)
  assert.equal(skadiFrame(ended.action, null), 0)
  assert.equal(skadiFrame(ended.action, 100), 0)
  assert.equal(skadiFrame('sleep', 100), 4)
})
test('Skadi settings migrate independently without changing the other pets or shared preferences', () => {
  const old = { ...DEFAULT_SETTINGS, foxSkin: 'jade', windowWidth: 190, clickThrough: true }
  for (const skin of SKADI_SKINS) {
    const next = { ...old, ...validateSettings({ scene: 'skadi', skadiSkin: skin.id }) }
    assert.equal(next.skadiSkin, skin.id); assert.equal(next.scene, 'skadi')
    assert.equal(next.foxSkin, 'jade'); assert.equal(next.windowWidth, 190); assert.equal(next.clickThrough, true)
  }
  assert.deepEqual(validateSettings({ skadiSkin: 'missing', scene: 'bad' }), {})
  assert.equal({ ...DEFAULT_SETTINGS, ...validateSettings({ scene: 'buddy' }) }.skadiSkin, 'classic')
})
test('matte removes green screen, preserves red eyes, skin, black dress and silver-blue hair', () => {
  assert.equal(skadiMatte(0,255,0), 1)
  for (const pixel of [[240,239,251],[165,180,207],[180,51,83],[241,194,190],[17,24,29]]) assert.equal(skadiMatte(...pixel as [number,number,number]), 0)
  assert.ok(skadiMatte(80,180,90) > 0 && skadiMatte(80,180,90) < 1)
})
