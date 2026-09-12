import test from 'node:test'
import assert from 'node:assert/strict'
import { hamsterLevel, hamsterIdle, beginHamster, tapHamsterWheel, advanceHamster } from '../src/hamster/play.ts'
import { DEFAULT_SETTINGS, SCENE_LABELS } from '../src/shared/types.ts'
import { validateSettings } from '../src/shared/settings.ts'

test('quota boundaries distinguish full, working, low, zero, and unknown', () => {
  assert.deepEqual([100,61,60,21,20,16,0,-1,null,NaN,Infinity].map(hamsterLevel), ['full','full','working','working','low','low','empty','empty','unknown','unknown','unknown'])
})
test('wheel requires six distinct taps; elapsed time and duplicate input cannot complete it', () => {
  let play = beginHamster('wheel', 0)
  assert.equal(advanceHamster(play, 99999).turns, 0)
  play = tapHamsterWheel(play, 100)
  assert.equal(tapHamsterWheel(play, 279).turns, 1)
  for (const time of [280,460,640,820,1000]) play = tapHamsterWheel(play, time)
  assert.equal(play.turns, 6); assert.equal(play.completedAt, 1000)
  assert.equal(tapHamsterWheel(play, 2000).turns, 6)
  assert.equal(advanceHamster(play, 1899).action, 'wheel')
  assert.deepEqual(advanceHamster(play, 1900), hamsterIdle())
})
test('sleep persists, short actions finish, replacement clears the old challenge', () => {
  assert.equal(advanceHamster(beginHamster('sleep', 0), 999999).action, 'sleep')
  assert.equal(advanceHamster(beginHamster('feed', 100), 3299).action, 'feed')
  assert.equal(advanceHamster(beginHamster('feed', 100), 3300).action, 'idle')
  assert.equal(advanceHamster(beginHamster('pet', 100), 1600).action, 'idle')
  const feed = beginHamster('feed', 400)
  assert.equal(tapHamsterWheel(feed, 600), feed)
  assert.equal(beginHamster('wheel', 2000).turns, 0)
})
test('hamster scene persists without touching other pets or shared preferences', () => {
  const old = { ...DEFAULT_SETTINGS, ...validateSettings({ scene:'beaver', beaverSkin:'snow', buddySkin:'worker', windowWidth:300, theme:'night' }) }
  const next = { ...old, ...validateSettings({ scene:'hamster' }) }
  assert.equal(SCENE_LABELS[next.scene], '仓鼠动力机房')
  assert.equal(next.beaverSkin, 'snow'); assert.equal(next.buddySkin, 'worker'); assert.equal(next.theme, 'night'); assert.equal(next.windowWidth, 300)
  assert.equal(validateSettings({ scene:'hamsterr' }).scene, undefined)
})

test('dedicated magenta matte does not remove white fur, eyes, red headband or blue blanket', async () => {
  const { hamsterMatte } = await import('../src/hamster/sprites.ts')
  assert.equal(hamsterMatte(255,0,255),1)
  for (const rgb of [[255,250,240],[10,10,10],[220,30,20],[70,130,220],[220,165,95],[250,180,170]]) assert.equal(hamsterMatte(...rgb as [number,number,number]),0)
})

test('every short prop action completes at its boundary and sleep never times out', async () => {
  const { HAMSTER_DURATIONS } = await import('../src/hamster/play.ts')
  for(const [action,duration] of Object.entries(HAMSTER_DURATIONS)){
    const play=beginHamster(action as Parameters<typeof beginHamster>[0], 200)
    assert.equal(advanceHamster(play, 200+duration-1).action, action)
    assert.deepEqual(advanceHamster(play,200+duration),hamsterIdle())
  }
})
test('hamster wardrobe validates and preserves shared settings and other outfits', () => {
  for(const hamsterSkin of ['classic','worker','nightshift','rain','summer','winter','holiday']) assert.equal(validateSettings({hamsterSkin}).hamsterSkin,hamsterSkin)
  assert.equal(validateSettings({hamsterSkin:'unknown'}).hamsterSkin,undefined)
  const result={...DEFAULT_SETTINGS,...validateSettings({hamsterSkin:'winter'})}
  assert.equal(result.scene,DEFAULT_SETTINGS.scene)
  assert.equal(result.buddySkin,DEFAULT_SETTINGS.buddySkin)
  assert.equal(result.beaverSkin,DEFAULT_SETTINGS.beaverSkin)
})
test('whole dressed leg cycle traverses six frames and reduced motion freezes each expression', async () => {
  const {hamsterRunFrame,HAMSTER_LAYOUT,overlaps} = await import('../src/hamster/layout.ts')
  assert.deepEqual([0,90,180,270,360,450,540].map(t=>hamsterRunFrame(t,false,false)),[0,1,2,3,4,5,0])
  assert.deepEqual([0,120,240,360,480,600,720].map(t=>hamsterRunFrame(t,true,false)),[6,7,8,9,10,11,6])
  assert.equal(hamsterRunFrame(99999,true,true),6)
  for(const part of ['visual','cat','cup','generator','quota'] as const)assert.equal(overlaps(HAMSTER_LAYOUT.actionDock,HAMSTER_LAYOUT[part]),false,part)
})


test('cat naps, yawns, and snacks in its own idle timeline; user actions override it',async()=>{
  const {catPose}=await import('../src/hamster/cat.ts')
  const idle=(t:number,night=false)=>catPose(t,'idle',0,t,night,false)
  assert.equal(idle(0).mood,'watch');assert.equal(idle(7000).mood,'yawn')
  assert.equal(idle(12000).mood,'sleep');assert.equal(idle(30000).mood,'snack')
  assert.equal(idle(43000).mood,'watch');assert.equal(idle(21000,true).mood,'sleep')
  assert.equal(catPose(12000,'bell',11000,12000,false,false).mood,'caught')
  assert.equal(catPose(12000,'feed',11000,12000,false,false).mood,'snack')
  assert.equal(catPose(12000,'cat-nap',12000,12000,false,true).mood,'sleep')
  assert.equal(catPose(30000,'idle',0,30000,false,true).frame,0)
})
test('cat actions do not stop a running hamster or alter its zero-quota rest',async()=>{
  const {hamsterRunning,hamsterFrame}=await import('../src/hamster/render.ts')
  for(const action of ['cat-yawn','cat-nap','cat-snack'] as const){
    assert.equal(hamsterRunning('full',action),true)
    assert.equal(hamsterRunning('empty',action),false)
    assert.equal(hamsterFrame('empty',action),5)
  }
})
