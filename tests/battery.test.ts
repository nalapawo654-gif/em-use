import test from 'node:test'
import assert from 'node:assert/strict'
import { batteryLevel, batteryIdle, beginBattery, advanceBattery, liftBattery, BATTERY_DURATIONS, LIFT_INTERVAL, BATTERY_EXERCISES } from '../src/battery/play.ts'
import { batteryPose, batteryGrounding, BATTERY_FLOOR } from '../src/battery/motion.ts'
import { batteryMatte } from '../src/battery/sprites.ts'
import { DEFAULT_SETTINGS, BATTERY_SKINS } from '../src/shared/types.ts'
import { validateSettings } from '../src/shared/settings.ts'

test('battery quota boundaries include six energy states and a distinct unknown', () => {
  assert.deepEqual([100,76,75,51,50,26,25,21,20,16,0,-1,null,NaN,Infinity].map(batteryLevel), ['full','full','bright','bright','steady','steady','tired','tired','low','low','empty','empty','unknown','unknown','unknown'])
})
test('six complete lifts require distinct presses; waiting and repeated input cannot finish the set', () => {
  let play = beginBattery('lift', 0, 100)
  assert.equal(advanceBattery(play, 999999, 100).reps, 0)
  for (let i = 0; i < 6; i++) {
    const now = i * 1200
    play = liftBattery(play, now)
    assert.equal(liftBattery(play, now + 200), play)
    assert.equal(advanceBattery(play, now + LIFT_INTERVAL - 1, 100).reps, i)
    play = advanceBattery(play, now + LIFT_INTERVAL, 100)
    assert.equal(play.reps, i + 1)
  }
  assert.equal(play.completedAt, 6900)
  assert.equal(liftBattery(play, 8000), play)
  assert.equal(advanceBattery(play, 8699, 100).action, 'lift')
  assert.deepEqual(advanceBattery(play, 8700, 100), batteryIdle())
})
test('no training at empty or unknown; an in-progress exercise stops when quota becomes unusable', () => {
  for (const percent of [0,-10,null,NaN,Infinity]) {
    for (const action of BATTERY_EXERCISES) {
      assert.deepEqual(beginBattery(action, 100, percent), batteryIdle())
      assert.deepEqual(advanceBattery(beginBattery(action, 0, 60), 100, percent), batteryIdle())
    }
    assert.equal(beginBattery('rest', 0, percent).action, 'rest')
  }
})
test('actions recover automatically, rest persists, replacement discards training progress', () => {
  for (const [action, duration] of Object.entries(BATTERY_DURATIONS)) {
    const play = beginBattery(action as Parameters<typeof beginBattery>[0], 100, 75)
    assert.equal(advanceBattery(play, duration + 99, 75).action, action)
    assert.deepEqual(advanceBattery(play, duration + 100, 75), batteryIdle())
  }
  assert.equal(advanceBattery(beginBattery('rest', 0, 75), 999999, 75).action, 'rest')
  assert.equal(beginBattery('charge', 500, 75).lastRep, -Infinity)
  assert.equal(beginBattery('lift', 500, 75).reps, 0)
})
test('full battery varies workouts; low and empty have reduced effort and deterministic gentle poses', () => {
  const idle = batteryIdle()
  assert.deepEqual([0,7000,14000].map(t => batteryPose(100,idle,t).exercise), ['jump','run','knees'])
  const efforts = [100,75,50,25,20,15].map(p => batteryPose(p,idle,100).effort)
  for (let i=1;i<efforts.length;i++) assert.ok(efforts[i]<efforts[i-1])
  assert.equal(batteryPose(0,idle,100).exercise,'lie')
  assert.equal(batteryPose(null,idle,100).exercise,'wait')
  for(const percent of [100,75,50,25,10,0,null]) {
    assert.deepEqual(batteryPose(percent,idle,100,true),batteryPose(percent,idle,99999,true))
    for(let t=0;t<21000;t+=90) {
      const pose=batteryPose(percent,idle,t)
      for(const point of [pose.leftHand,pose.rightHand,pose.leftFoot,pose.rightFoot]) assert.ok(point.every(Number.isFinite))
      assert.ok(Number.isFinite(pose.angle))
    }
  }
})
test('new settings validate and preserve other pets, window preferences, and old installations', () => {
  for(const skin of BATTERY_SKINS) assert.equal(validateSettings({batterySkin:skin.id}).batterySkin,skin.id)
  for(const batteryRealm of ['office','balcony','overtime','weekend']) assert.equal(validateSettings({batteryRealm}).batteryRealm,batteryRealm)
  assert.deepEqual(validateSettings({batterySkin:'invalid',batteryRealm:'invalid'}),{})
  const old={...DEFAULT_SETTINGS,beaverSkin:'snow',hamsterSkin:'winter',windowWidth:300,theme:'night'}
  const next={...old,...validateSettings({scene:'battery',batterySkin:'catl'})}
  assert.equal(next.scene,'battery');assert.equal(next.beaverSkin,'snow');assert.equal(next.hamsterSkin,'winter');assert.equal(next.windowWidth,300);assert.equal(next.theme,'night')
  assert.equal({...DEFAULT_SETTINGS,...validateSettings({scene:'aquarium'})}.batterySkin,'classic')
})
test('runtime matte removes the keyed background while preserving logo and shell colors', () => {
  assert.equal(batteryMatte(255,0,255),1)
  for(const rgb of [[255,255,255],[15,15,15],[200,30,30],[30,80,180],[75,165,50],[225,185,105],[200,185,240]]) assert.equal(batteryMatte(...rgb as [number,number,number]),0)
})


test('grounded movement keeps a support shoe on the floor; hops lift both without clipping through it', () => {
  for (const action of ['idle', ...BATTERY_EXERCISES, 'charge', 'towel', 'cheer'] as const) {
    for (const percent of [100, 75, 25, 20]) for (let time=0;time<42000;time+=170) {
      const pose=batteryPose(percent,beginBattery(action,0,percent),time)
      const ground=batteryGrounding(pose)
      const support=Math.max(ground.leftSole[1],ground.rightSole[1])
      assert.ok(Math.abs(support-(BATTERY_FLOOR-pose.air))<1e-8,action)
      assert.ok(support<=BATTERY_FLOOR+1e-8)
      assert.ok(ground.leftSole[0]>110 && ground.rightSole[0]<365,'shoe centers stay clear of side props')
    }
  }
})
test('new workouts have distinct poses, join daily rotations, and respect reduced motion', () => {
  const idle=batteryIdle()
  assert.deepEqual([21000,28000,35000].map(t=>batteryPose(100,idle,t).exercise),['taichi','aerobics','yoga'])
  const hands=new Set()
  for (const action of ['taichi','aerobics','yoga'] as const) {
    const play=beginBattery(action,0,100)
    hands.add(JSON.stringify(batteryPose(100,play,900).leftHand))
    assert.notDeepEqual(batteryPose(100,play,900),batteryPose(100,play,2900))
    assert.deepEqual(batteryPose(100,play,900,true),batteryPose(100,play,2900,true))
  }
  assert.equal(hands.size,3)
})
test('charging can comfort an empty battery without granting energy or restarting exercise', () => {
  const play=beginBattery('charge',0,0)
  assert.equal(batteryPose(0,play,1000).exercise,'charge')
  assert.equal(batteryLevel(0),'empty')
  assert.equal(advanceBattery(play,6399,0).action,'charge')
  const done=advanceBattery(play,6400,0)
  assert.equal(done.action,'idle');assert.equal(batteryPose(0,done,6400).exercise,'lie')
  assert.equal(batteryPose(null,play,1000).exercise,'charge')
})
test('all five renamed skins use original words, with legacy IDs retained only for saved settings',()=>{
  assert.deepEqual(BATTERY_SKINS.map(s=>s.label),['元气绿','北孚','大米','铜霸王','A亚迪','您德时代'])
  assert.equal(BATTERY_SKINS.find(s=>s.id==='byd')?.mark,'AYD')
  assert.ok(BATTERY_SKINS.every(s=>!('logo' in s)))
})
