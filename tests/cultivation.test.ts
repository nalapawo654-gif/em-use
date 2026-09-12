import test from 'node:test'
import assert from 'node:assert/strict'
import { cultivationLevel, cultivationIdle, beginCultivation, lightSeal, combStroke, advanceCultivation, CULTIVATION_ACTIONS } from '../src/cultivation/play.ts'
import { DEFAULT_SETTINGS } from '../src/shared/types.ts'
import { validateSettings } from '../src/shared/settings.ts'
test('cultivation covers quota boundaries and unknown without inventing full quota', () => {
  assert.deepEqual([100,61,60,21,20,16,0,-1,null,NaN,Infinity].map(cultivationLevel),['full','full','settling','settling','low','low','empty','empty','unknown','unknown','unknown'])
})
test('talisman only progresses through three distinct seals in order', () => {
  let p=beginCultivation('talisman',100)
  assert.equal(lightSeal(p,2,120),p)
  p=lightSeal(p,0,140);assert.equal(p.progress,1)
  assert.equal(lightSeal(p,0,150),p)
  assert.equal(advanceCultivation(p,999999),p)
  p=lightSeal(p,1,160);p=lightSeal(p,2,180)
  assert.equal(p.completedAt,180);assert.equal(lightSeal(p,2,190),p)
  assert.equal(advanceCultivation(p,1379),p)
  assert.deepEqual(advanceCultivation(p,1380),cultivationIdle())
})
test('comb needs real accumulated distance and rejects stationary points and jumps', () => {
  let p=beginCultivation('comb',0)
  for(const n of [0,-1,NaN,Infinity,.31]) assert.equal(combStroke(p,n,1),p)
  for(let i=0;i<4;i++) p=combStroke(p,.24,100+i)
  assert.equal(p.completedAt,null)
  p=combStroke(p,.24,200);assert.equal(p.completedAt,200)
  assert.equal(combStroke(p,.24,300),p)
  assert.deepEqual(advanceCultivation(p,1400),cultivationIdle())
})
test('short actions expire; replacement clears progress and props without quota inputs', () => {
  for(const a of CULTIVATION_ACTIONS.filter(a=>a.duration>0)) {
    const p=beginCultivation(a.id,100)
    assert.equal(advanceCultivation(p,99+a.duration),p)
    assert.deepEqual(advanceCultivation(p,100+a.duration),cultivationIdle())
  }
  assert.equal(advanceCultivation(beginCultivation('greet',0),1800).action,'idle')
  const p=beginCultivation('tea',200);assert.equal(p.progress,0);assert.equal(p.completedAt,null)
})
test('realm validates and persists separately from other pet outfits and shared preferences', () => {
  const old={...DEFAULT_SETTINGS,buddySkin:'worker',hamsterSkin:'winter',theme:'night',windowWidth:300}
  for(const realm of ['sunny','rain','night','thunder','tribulation','enlightened']) assert.equal(validateSettings({cultivationRealm:realm}).cultivationRealm,realm)
  assert.deepEqual(validateSettings({cultivationRealm:'storm',scene:'immortal'}),{})
  const next={...old,...validateSettings({scene:'cultivation',cultivationRealm:'rain'})}
  assert.equal(next.scene,'cultivation');assert.equal(next.cultivationRealm,'rain');assert.equal(next.hamsterSkin,'winter');assert.equal(next.buddySkin,'worker');assert.equal(next.theme,'night');assert.equal(next.windowWidth,300)
  assert.equal({...DEFAULT_SETTINGS,...validateSettings({scene:'aquarium'})}.cultivationRealm,'sunny')
})
