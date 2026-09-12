import test from 'node:test'
import assert from 'node:assert/strict'
import { FOX_ACTIONS, advanceFox, beginFox, foxIdle, foxLevel, foxPose } from '../src/fox/play.ts'
import { FOX_SKINS, DEFAULT_SETTINGS, SCENE_LABELS } from '../src/shared/types.ts'
import { validateSettings } from '../src/shared/settings.ts'
import { foxMatte, tintFoxPixels } from '../src/fox/sprites.ts'

test('fox quota boundaries keep unknown separate from zero, including nonfinite inputs', () => {
  assert.deepEqual([101,100,60.01,60,50,20.01,20,20,16,0,-1,null,NaN,Infinity].map(foxLevel), ['full','full','full','medium','medium','medium','low','low','low','empty','empty','unknown','unknown','unknown'])
})
test('fox short actions expire precisely and persistent rest has explicit restoration', () => {
  for (const action of FOX_ACTIONS) {
    const started = beginFox(action.id, 100)
    if (action.duration === null) assert.equal(advanceFox(started, 1e8), started)
    else {
      assert.equal(advanceFox(started, action.duration + 99), started)
      const ended = advanceFox(started, action.duration + 100)
      assert.deepEqual(ended, foxIdle())
      assert.equal(foxPose(0, ended.action), 'empty')
      assert.equal(foxPose(null, ended.action), 'unknown')
      assert.equal(foxPose(10, ended.action), 'empty')
    }
  }
  assert.equal(foxPose(100, 'rest'), 'empty')
  assert.equal(foxPose(100, beginFox('idle', 1e8).action), 'full')
})
test('new fox actions replace old timers and current quota owns the restored pose', () => {
  const paper = beginFox('paper', 0), tail = beginFox('tail', 4000)
  assert.equal(advanceFox(paper, 4500).action, 'idle')
  assert.equal(advanceFox(tail, 4500).action, 'tail')
  assert.equal(foxPose(0, advanceFox(tail, 6800).action), 'empty')
  assert.equal(foxPose(50, advanceFox(tail, 6800).action), 'medium')
  assert.equal(foxPose(null, advanceFox(tail, 6800).action), 'unknown')
})
test('fox settings migrate independently and reject invalid colors without resetting other pets', () => {
  assert.equal(SCENE_LABELS.fox, '水墨小狐')
  for (const skin of FOX_SKINS) assert.equal(validateSettings({ foxSkin: skin.id }).foxSkin, skin.id)
  assert.deepEqual(validateSettings({ foxSkin: 'invalid', scene: 'bad' }), {})
  const prior = { ...DEFAULT_SETTINGS, feiduduSkin: 'peach', hamsterSkin: 'winter', clickThrough: true, windowWidth: 190 }
  const next = { ...prior, ...validateSettings({ scene: 'fox', foxSkin: 'jade' }) }
  assert.equal(next.foxSkin, 'jade'); assert.equal(next.scene, 'fox'); assert.equal(next.feiduduSkin, 'peach'); assert.equal(next.hamsterSkin, 'winter'); assert.equal(next.clickThrough, true); assert.equal(next.windowWidth, 190)
  assert.equal({ ...DEFAULT_SETTINGS, ...validateSettings({ scene: 'buddy' }) }.foxSkin, 'classic')
})
test('fox chroma removes green background while preserving white fur, ink and cinnabar', () => {
  assert.equal(foxMatte(0,255,0),1)
  for (const [r,g,b] of [[250,247,235],[20,25,22],[123,124,119],[190,61,35],[245,160,130]]) assert.equal(foxMatte(r,g,b),0)
  assert.ok(foxMatte(50,145,55)>0 && foxMatte(50,145,55)<1)
})

test('ink tints preserve cinnabar, ivory and every alpha value', () => {
  const source = [190,61,35,255,250,247,235,255,90,90,90,140,20,20,20,0]
  for(const skin of ['jade','sepia'] as const){
    const d = new Uint8ClampedArray(source);tintFoxPixels(d,skin)
    assert.deepEqual([...d.slice(0,8)],source.slice(0,8))
    assert.equal(d[11],140);assert.deepEqual([...d.slice(12)],source.slice(12))
    assert.notDeepEqual([...d.slice(8,11)],source.slice(8,11))
  }
})

test('elegant ambient pools preserve the current energy posture', async () => {
  const {foxMotionPool,chooseFoxMotion} = await import('../src/fox/ambient.ts')
  assert.ok(foxMotionPool('full').includes('groom'))
  assert.ok(foxMotionPool('unknown').includes('groom'))
  assert.ok(!foxMotionPool('medium').includes('groom'))
  assert.ok(!foxMotionPool('low').includes('groom'))
  assert.deepEqual(foxMotionPool('empty'),['blink','doze'])
  for(const level of ['full','medium','low','empty','unknown'] as const){
    const pool=foxMotionPool(level)
    for(const previous of pool)for(const random of [0,.2,.5,.9,1]){
      const motion=chooseFoxMotion(level,previous,()=>random)
      assert.notEqual(motion,previous);assert.ok(pool.includes(motion))
    }
  }
})
test('ambient easing joins exact resting poses with gentle endpoints', async () => {
  const {FOX_MOTIONS,foxEnvelope,foxGroomPose,foxBlink,foxMotionDelay} = await import('../src/fox/ambient.ts')
  for(const p of [-1,0,1,2]){assert.equal(foxEnvelope(p),0);assert.equal(foxBlink(p),0);assert.equal(foxGroomPose(p).lift,0);assert.equal(foxGroomPose(p).stroke,0)}
  assert.equal(foxEnvelope(.5),1);assert.ok(foxEnvelope(.001)<.000001);assert.ok(foxEnvelope(.999)<.000001)
  for(let i=0;i<=100;i++){const pose=foxGroomPose(i/100);assert.ok(pose.lift>=0&&pose.lift<=1);assert.ok(pose.close>=0&&pose.close<=1);assert.ok(Math.abs(pose.stroke)<=1)}
  assert.equal(foxMotionDelay(()=>0,true),1800);assert.equal(foxMotionDelay(()=>1,true),3200)
  assert.equal(foxMotionDelay(()=>0),6500);assert.equal(foxMotionDelay(()=>1),13000)
  assert.ok(FOX_MOTIONS.groom.duration>5000)
})
