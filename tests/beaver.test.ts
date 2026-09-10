import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advanceBeaver, beaverIdle, beaverLevel, beginBeaver, collectLeaf, groomStroke, BEAVER_DURATIONS } from '../src/beaver/play.ts'
import { BEAVER_APPEARANCES } from '../src/beaver/appearance.ts'
import { sampleBeaverMotion } from '../src/beaver/motion.ts'
import { validateSettings } from '../src/shared/settings.ts'
import { DEFAULT_SETTINGS, SCENE_LABELS } from '../src/shared/types.ts'

test('beaver distinguishes all six quota ranges and unknown has a neutral visual', () => {
  assert.deepEqual([100, 76, 75, 51, 50, 26, 25, 11, 10, 1, 0].map(beaverLevel), [0,0,1,1,2,2,3,3,4,4,5])
  assert.equal(beaverLevel(null), 0); assert.equal(beaverLevel(NaN), 0)
})
test('grooming requires real movement and invalid or stationary input cannot complete it', () => {
  const initial = beginBeaver('groom', 100)
  let p = initial
  for (let i = 0; i < 200; i++) p = groomStroke(p, 0, 200)
  assert.deepEqual(p, initial)
  assert.deepEqual(groomStroke(p, NaN, 200), initial)
  assert.deepEqual(groomStroke(p, -1, 200), initial)
  assert.equal(groomStroke(p, 1000, 200).mode, 'groom')
  for (let i = 0; i < 20; i++) p = groomStroke(p, .1, 300)
  assert.equal(p.mode, 'celebrate')
  assert.equal(advanceBeaver(p, 300 + BEAVER_DURATIONS.celebrate).mode, 'idle')
  assert.deepEqual(groomStroke(beaverIdle(), .1, 400), beaverIdle())
})
test('leaf collection deduplicates hits, rejects invalid IDs and has an idle timeout', () => {
  let p = beginBeaver('leaves', 100)
  for (let i = 0; i < 20; i++) p = collectLeaf(p, 0, 300)
  assert.deepEqual(p.collected, [0]); assert.equal(p.mode, 'leaves')
  assert.deepEqual(collectLeaf(p, 9, 400), p); assert.deepEqual(collectLeaf(p, .5, 400), p)
  p = collectLeaf(p, 1, 500); p = collectLeaf(p, 2, 600)
  assert.equal(p.mode, 'celebrate')
  assert.equal(advanceBeaver(beginBeaver('leaves', 100), 18100).mode, 'idle')
})
test('every short play recovers; replacing it removes old progress and timing', () => {
  for (const [mode, duration] of Object.entries(BEAVER_DURATIONS)) {
    const p = beginBeaver(mode as keyof typeof BEAVER_DURATIONS, 100)
    assert.equal(advanceBeaver(p, 100 + duration - 1).mode, mode)
    assert.equal(advanceBeaver(p, 100 + duration).mode, 'idle')
    assert.equal(advanceBeaver(p, 1900, true).mode, 'idle')
  }
  assert.equal(advanceBeaver(beginBeaver('groom', 0), 99999).mode, 'groom')
  assert.deepEqual(beginBeaver('drink', 700), { mode:'drink', since:700, strokes:0, collected:[] })
})
test('new scene settings validate and old scene preferences retain their independent choices', () => {
  const old = { ...DEFAULT_SETTINGS, ...validateSettings({ scene:'buddy', buddySkin:'worker', outfit:'royal' }) }
  assert.equal(old.scene, 'buddy'); assert.equal(old.beaverSkin, 'sunny')
  const next = { ...old, ...validateSettings({ scene:'beaver', beaverSkin:'snow', beaverCamp:true, beaverMotto:'rest' }) }
  assert.equal(next.buddySkin,'worker'); assert.equal(next.outfit,'royal'); assert.equal(next.beaverSkin,'snow')
  assert.equal(SCENE_LABELS[next.scene], '林间海狸鼠')
  assert.deepEqual(validateSettings({ beaverSkin:'storm', beaverCamp:1, beaverMotto:'invalid' }), {})
})
test('idle gnaws continuously at every positive quota and rests only at zero', () => {
  for (const level of [0,1,2,3,4]) {
    const a=sampleBeaverMotion('idle',0,1000,level),b=sampleBeaverMotion('idle',0,1200,level)
    assert.notEqual(a.jaw,b.jaw);assert.notEqual(a.head,b.head)
    assert.equal(a.chips,true);assert.equal(a.amount,0)
  }
  assert.equal(sampleBeaverMotion('idle',0,1500,5).chew,0)
  assert.equal(sampleBeaverMotion('rest',1000,1500,1).resting,true)
})
test('each timed interaction leaves the tree and recovers its exact current idle pose', () => {
  for(const [mode,duration] of Object.entries(BEAVER_DURATIONS)) {
    if(mode==='rest') continue
    const action=mode as keyof typeof BEAVER_DURATIONS
    const start=sampleBeaverMotion(action,0,800,1),active=sampleBeaverMotion(action,1200,2000,1),end=sampleBeaverMotion(action,duration,8000,1),idle=sampleBeaverMotion('idle',0,8000,1)
    assert.equal(start.amount,0);assert.equal(active.phase,'perform');assert.equal(active.amount,1)
    assert.ok(active.x<start.x-50);assert.equal(end.amount,0)
    for(const key of ['x','y','head','jaw','headX','headY','tail','paw'] as const) assert.equal(end[key],idle[key],`${mode} recovers ${key}`)
  }
})
test('eating articulates the jaw, drinking gulps, and non-food actions stop gnawing', () => {
  for(const action of ['feed','wood','drink'] as const) {
    const a=sampleBeaverMotion(action,1500,1500,1),b=sampleBeaverMotion(action,1700,1700,1)
    assert.notEqual(a.jaw,b.jaw)
  }
  for(const action of ['pet','groom','bird','ball','leaves'] as const) {
    const a=sampleBeaverMotion(action,1500,1500,1),b=sampleBeaverMotion(action,1700,1700,1)
    assert.equal(a.chew,0);assert.equal(a.chips,false);assert.notEqual(a.paw,b.paw)
  }
})
test('reduced motion holds a meaningful interaction pose without repetitive motion', () => {
  const a=sampleBeaverMotion('drink',900,900,1,true),b=sampleBeaverMotion('drink',1100,1100,1,true)
  for(const key of ['head','jaw','tail','paw','breathe','x'] as const) assert.equal(a[key],b[key])
  assert.ok(a.head<-.1);assert.equal(a.amount,1);assert.equal(a.chips,false)
  assert.equal(sampleBeaverMotion('drink',1800,1800,1,true).amount,0)
  assert.equal(sampleBeaverMotion('idle',0,1000,1,true).chew,0)
})

test('quota controls six distinct paired expressions and tree damage states', () => {
  assert.equal(BEAVER_APPEARANCES[beaverLevel(50)].removed,.5)
  assert.deepEqual([100,75,50,25,10,0].map(p=>BEAVER_APPEARANCES[beaverLevel(p)].removed),[0,.25,.5,.75,.9,1])
  assert.equal(new Set(BEAVER_APPEARANCES.map(p=>p.expression)).size,6)
  assert.equal(new Set(BEAVER_APPEARANCES.map(p=>p.tree)).size,6)
  let previous=sampleBeaverMotion('idle',0,1000,0)
  for(let level=1;level<5;level++) {
    const current=sampleBeaverMotion('idle',0,1000,level)
    assert.ok(current.headY>previous.headY);assert.ok(current.bodyScale<previous.bodyScale)
    previous=current
  }
})
test('interactions and their recovery retain the live quota expression', () => {
  for(const percent of [100,75,50,25,10,0]) {
    const level=beaverLevel(percent)
    for(const action of ['feed','drink','wood','pet'] as const) {
      const state=beginBeaver(action,0)
      assert.equal(sampleBeaverMotion(state.mode,1500,1500,level).level,level)
      const recovered=advanceBeaver(state,BEAVER_DURATIONS[action])
      assert.equal(recovered.mode,'idle')
      const motion=sampleBeaverMotion(recovered.mode,0,6000,level)
      assert.equal(motion.level,level);assert.equal(motion.resting,percent===0)
    }
  }
})
