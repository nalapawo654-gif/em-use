import test from 'node:test'
import assert from 'node:assert/strict'
import { FEIDUDU_ACTIONS, advanceFeidudu, beginFeidudu, feiduduIdle, feiduduLevel, feiduduFrame } from '../src/feidudu/play.ts'
import { FEIDUDU_SKINS, DEFAULT_SETTINGS, SCENE_LABELS } from '../src/shared/types.ts'
import { validateSettings } from '../src/shared/settings.ts'
import { FEIDUDU_CROPS, feiduduMatte } from '../src/feidudu/sprites.ts'

test('Feidudu includes exact five quota boundaries and distinct unknown states', () => {
  assert.deepEqual([101, 100, 80.1, 80, 70, 60, 50, 20, 20, 16, 0, -1, null, NaN, Infinity].map(feiduduLevel), ['full','full','full','tea','tea','tired','tired','low','low','low','empty','empty','unknown','unknown','unknown'])
  assert.deepEqual([100,70,50,20,15,null].map(value => feiduduFrame(value)), [0,1,2,3,4,0])
})
test('all short interactions expire; work and rest persist with explicit cancellation', () => {
  for (const item of FEIDUDU_ACTIONS) {
    const play = beginFeidudu(item.id, 100)
    if (item.duration !== null) {
      assert.equal(advanceFeidudu(play, item.duration + 99).action, item.id)
      assert.deepEqual(advanceFeidudu(play, item.duration + 100), feiduduIdle())
    } else assert.equal(advanceFeidudu(play, 999999).action, item.id)
    assert.deepEqual(beginFeidudu('idle', 1000), feiduduIdle())
    assert.equal(feiduduFrame(0, item.id), item.frame)
  }
})
test('replacement restarts its own clock, preserves quota, and resumes current quota pose', () => {
  const quota = Object.freeze({ percent: 10, remaining: 30 })
  const before = { ...quota }
  const old = beginFeidudu('tea', 0), next = beginFeidudu('cookie', 3000)
  assert.equal(advanceFeidudu(next, 5000), next)
  assert.equal(advanceFeidudu(old, 5000).action, 'idle')
  const done = advanceFeidudu(next, 7000)
  assert.equal(feiduduFrame(quota.percent, done.action), 4)
  assert.equal(feiduduFrame(0, done.action), 4)
  assert.equal(feiduduFrame(null, done.action), 0)
  assert.deepEqual(quota, before)
})
test('new scene and independent colors validate and migrate without altering other pets or preferences', () => {
  assert.equal(SCENE_LABELS.feidudu, '肥嘟嘟')
  for (const skin of FEIDUDU_SKINS) assert.equal(validateSettings({ feiduduSkin: skin.id }).feiduduSkin, skin.id)
  assert.deepEqual(validateSettings({ feiduduSkin: 'bogus', scene: 'bogus' }), {})
  const prior = { ...DEFAULT_SETTINGS, hamsterSkin: 'winter', buddySkin: 'worker', windowWidth: 190, clickThrough: true }
  const next = { ...prior, ...validateSettings({ scene: 'feidudu', feiduduSkin: 'peach' }) }
  assert.equal(next.scene, 'feidudu'); assert.equal(next.hamsterSkin, 'winter'); assert.equal(next.buddySkin, 'worker'); assert.equal(next.windowWidth, 190); assert.equal(next.clickThrough, true)
  assert.equal({ ...DEFAULT_SETTINGS, ...validateSettings({ scene: 'aquarium' }) }.feiduduSkin, 'classic')
})
test('chroma matte preserves yellow body, cream belly, brown nose, lavender cushion and gray laptop', () => {
  assert.equal(feiduduMatte(255, 0, 255), 1)
  for (const [r,g,b] of [[255,205,40],[255,243,182],[136,57,15],[170,153,192],[160,160,170]]) assert.equal(feiduduMatte(r!,g!,b!),0)
  assert.equal(FEIDUDU_CROPS.length, 9)
  for (const [x,y,w,h] of FEIDUDU_CROPS) { assert.ok(x>=0 && y>=0 && x+w<=1254 && y+h<=1254) }
})


test('new body colors preserve alpha and non-yellow face or prop pixels', async () => {
  const { tintFeiduduPixels } = await import('../src/feidudu/skins.ts')
  const sample = [255, 205, 40, 180, 255, 255, 255, 255, 136, 57, 15, 255, 170, 153, 192, 255, 160, 160, 170, 255, 255, 205, 40, 0]
  for (const skin of ['black-purple', 'eleme-blue', 'jd-red'] as const) {
    const pixels = new Uint8ClampedArray(sample)
    tintFeiduduPixels(pixels, skin)
    assert.equal(pixels[3], 180)
    assert.deepEqual([...pixels.slice(4)], sample.slice(4))
    const [r,g,b] = pixels
    if (skin === 'black-purple') assert.ok(b! > r! && r! > g! && b! < 180)
    if (skin === 'eleme-blue') assert.ok(b! > g! && g! > r!)
    if (skin === 'jd-red') assert.ok(r! > 200 && g! < 60 && b! < 70)
  }
  const original = new Uint8ClampedArray(sample)
  tintFeiduduPixels(original, 'classic')
  assert.deepEqual([...original], sample)
})

test('ambient selection is randomized without consecutive repeats and respects each resting pose', async () => {
  const { feiduduMotionPool, chooseFeiduduMotion, feiduduMotionDelay, FEIDUDU_MOTIONS } = await import('../src/feidudu/ambient.ts')
  for (let frame=0; frame<5; frame++) {
    const pool=feiduduMotionPool(frame), seen=new Set<string>()
    for (let i=0;i<pool.length;i++) seen.add(chooseFeiduduMotion(frame,null,()=> (i+.5)/pool.length)!)
    assert.deepEqual([...seen].sort(), [...pool].sort())
    for(const previous of pool) assert.notEqual(chooseFeiduduMotion(frame,previous,()=>0),previous)
  }
  assert.ok(feiduduMotionPool(0).includes('belly'))
  assert.ok(!feiduduMotionPool(4).includes('stretch'))
  assert.ok(feiduduMotionPool(1).includes('yawn'))
  for(const frame of [5,6,7,8]) assert.equal(chooseFeiduduMotion(frame,null),null)
  assert.equal(feiduduMotionDelay(()=>0,true),3000)
  assert.equal(feiduduMotionDelay(()=>1,true),8000)
  assert.equal(feiduduMotionDelay(()=>0),5000)
  assert.equal(feiduduMotionDelay(()=>1),13000)
  for(const spec of Object.values(FEIDUDU_MOTIONS)) assert.ok(spec.duration>=1500 && spec.duration<=4000)
})
test('local motions ease back to the exact original pose at both boundaries', async () => {
  const { motionEnvelope } = await import('../src/feidudu/ambient.ts')
  assert.equal(motionEnvelope(0),0);assert.equal(motionEnvelope(1),0)
  assert.equal(motionEnvelope(-1),0);assert.equal(motionEnvelope(2),0)
  assert.equal(motionEnvelope(.5),1)
  for(let i=0;i<=100;i++) assert.ok(motionEnvelope(i/100)>=0 && motionEnvelope(i/100)<=1)
  assert.ok(motionEnvelope(.001)<.001 && motionEnvelope(.999)<.001)
})

test('tea pose puts its cup aside only for motions needing a free face or hands', async () => {
  const { feiduduAmbientFrame } = await import('../src/feidudu/ambient.ts')
  for(const motion of ['belly','yawn','stretch','foot'] as const) assert.equal(feiduduAmbientFrame(1,motion),0)
  for(const motion of ['eyes','ears','blink','nod','sniff'] as const) assert.equal(feiduduAmbientFrame(1,motion),1)
  for(let frame=0;frame<5;frame++) if(frame!==1) assert.equal(feiduduAmbientFrame(frame,'yawn'),frame)
})
