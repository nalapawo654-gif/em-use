import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseDinosaurMotion,dinosaurMotionPool,dinosaurMotionDelay,dinosaurFlight,dinosaurPhone,ease,envelope,DINOSAUR_MOTIONS } from '../src/dinosaur/ambient.ts'
import { advanceDinosaur,beginDinosaur,dinosaurFrame } from '../src/dinosaur/play.ts'

test('daily choices respect energy and avoid repeats; empty never takes off',()=>{
  for(const level of ['full','tea','tired','low','empty','unknown'] as const){
    const pool=dinosaurMotionPool(level)
    for(const previous of pool){const next=chooseDinosaurMotion(level,previous,()=>.5);assert.notEqual(next,previous);assert.ok(next&&pool.includes(next))}
    for(const r of [0,.25,.5,.75,1]){const next=chooseDinosaurMotion(level,null,()=>r);assert.ok(next===null?pool.length===0:pool.includes(next))}
  }
  assert.equal(chooseDinosaurMotion('empty',null),null)
  assert.ok(!dinosaurMotionPool('low').includes('fly'));assert.ok(!dinosaurMotionPool('tired').includes('fly'))
  assert.ok(dinosaurMotionPool('full').includes('phone'))
  assert.deepEqual([dinosaurMotionDelay(()=>0,true),dinosaurMotionDelay(()=>1,true),dinosaurMotionDelay(()=>0),dinosaurMotionDelay(()=>1)],[4000,7000,9000,17000])
})
test('flight returns to exact ground pose with a continuous path and moving wings',()=>{
  const ground={x:0,y:0,scale:1,angle:0,wings:0,flap:0}
  assert.deepEqual(dinosaurFlight(0),ground);assert.deepEqual(dinosaurFlight(1),ground)
  let prev=dinosaurFlight(0),minX=0,maxX=0
  for(let i=1;i<=1000;i++){const s=dinosaurFlight(i/1000);for(const v of Object.values(s))assert.ok(Number.isFinite(v));assert.ok(s.scale>=.62&&s.scale<=1);assert.ok(s.wings>=0&&s.wings<=1);assert.ok(Math.abs(s.x-prev.x)<4&&Math.abs(s.y-prev.y)<4);minX=Math.min(minX,s.x);maxX=Math.max(maxX,s.x);prev=s}
  assert.ok(minX< -60&&maxX>60)
  assert.notEqual(dinosaurFlight(.37).flap,dinosaurFlight(.38).flap)
})
test('phone enters, swipes and leaves without a leftover prop',()=>{
  assert.equal(dinosaurPhone(0).hold,0);assert.equal(dinosaurPhone(1).hold,0)
  assert.equal(dinosaurPhone(.5).hold,1)
  assert.notEqual(dinosaurPhone(.42).swipe,dinosaurPhone(.46).swipe)
  assert.equal(envelope(0),0);assert.equal(envelope(1),0);assert.equal(ease(0),0);assert.equal(ease(1),1)
})
test('all daily actions end or can be replaced, then use current quota',()=>{
  for(const [id,spec] of Object.entries(DINOSAUR_MOTIONS)){
    const play=beginDinosaur(id as keyof typeof DINOSAUR_MOTIONS,100)
    assert.equal(advanceDinosaur(play,99+spec.duration).action,id)
    const done=advanceDinosaur(play,100+spec.duration);assert.equal(done.action,'idle')
    assert.equal(dinosaurFrame(0,done.action),4);assert.equal(dinosaurFrame(10,done.action),4);assert.equal(dinosaurFrame(null,done.action),0)
  }
  const replaced=beginDinosaur('phone',3000);assert.equal(advanceDinosaur(replaced,9500),replaced)
  assert.equal(beginDinosaur('idle',5000).action,'idle')
})
