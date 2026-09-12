import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceLuckyCat, beginLuckyCat, luckycatFrame, luckycatLevel, LUCKYCAT_ACTIONS } from '../src/luckycat/play'
import { luckycatAlpha } from '../src/luckycat/sprites'
import { validateSettings } from '../src/shared/settings'
import { DEFAULT_SETTINGS } from '../src/shared/types'
test('quota boundaries preserve unknown, zero, and each tier', () => {
  for (const value of [null, NaN, Infinity]) assert.equal(luckycatLevel(value), 'unknown')
  for (const [value, level] of [[100,'full'],[61,'full'],[60,'medium'],[21,'medium'],[20,'low'],[16,'low'],[0,'empty'],[-1,'empty']] as const) assert.equal(luckycatLevel(value),level)
  assert.equal(luckycatFrame(null),1)
})
test('short actions return to the latest quota and persistent box requires cancellation', () => {
  for (const action of LUCKYCAT_ACTIONS) {
    const play=beginLuckyCat(action.id, 100)
    if(action.duration===null){assert.equal(advanceLuckyCat(play,999999).action,'box');continue}
    assert.equal(advanceLuckyCat(play,99+action.duration).action,action.id)
    const done=advanceLuckyCat(play,100+action.duration)
    assert.equal(done.action,'idle')
    assert.equal(luckycatFrame(0,done.action),3)
  }
  assert.deepEqual(beginLuckyCat('idle',900),{action:'idle',startedAt:0})
  assert.equal(luckycatFrame(0,'box'),7)
  assert.equal(luckycatFrame(0,'fish'),5)
})
test('settings retain other pets and accept only declared luckycat preferences', () => {
  const saved={...DEFAULT_SETTINGS,...validateSettings({scene:'luckycat',luckycatSkin:'festival'})}
  assert.equal(saved.scene,'luckycat'); assert.equal(saved.luckycatSkin,'festival')
  assert.equal(saved.foxSkin,DEFAULT_SETTINGS.foxSkin)
  assert.deepEqual(validateSettings({scene:'not-a-pet',luckycatSkin:'neon'}),{})
})
test('chroma key preserves white calico fur, gold and red while removing green', () => {
  assert.equal(luckycatAlpha(0,255,0),0)
  for(const pixel of [[255,255,255],[225,160,40],[200,50,30],[30,25,20]]) assert.equal(luckycatAlpha(...pixel as [number,number,number]),1)
  assert.ok(luckycatAlpha(90,170,90)>0 && luckycatAlpha(90,170,90)<1)
})
