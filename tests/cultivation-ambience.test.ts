import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceAmbience, createAmbience, craneCanFly, craneFlight, showIncense, type AmbienceOptions } from '../src/cultivation/ambience.ts'
const normal:AmbienceOptions={paused:false,reduced:false,active:false,realm:'sunny',practice:'breath',encounter:null}
test('crane flight stays inside the scene and crosses above the face, with a resting interval',()=>{
  for(let t=0;t<32000;t+=33){const p=craneFlight(t);assert.ok(p.x>=-49&&p.x<=0);assert.ok(p.y>=-38&&p.y<=0);if(p.x < -8)assert.ok(p.y<=-35)}
  for(const t of [0,5000,25000,31999])assert.equal(craneFlight(t).y,0)
})
test('rain, thunder, swords, interactions and all encounters reserve the airspace',()=>{
  for(const realm of ['rain','thunder','tribulation'] as const)assert.equal(craneCanFly({...normal,realm}),false)
  assert.equal(craneCanFly({...normal,practice:'sword'}),false)
  assert.equal(craneCanFly({...normal,active:true}),false)
  assert.equal(craneCanFly({...normal,encounter:{kind:'crane-letter',elapsed:0}}),false)
  assert.equal(craneCanFly({...normal,realm:'night'}),true)
})
test('a midair event lands continuously, then the next flight waits through its resting interval',()=>{
  let s={...createAmbience(),flightTime:12000,crane:craneFlight(12000)}
  const options={...normal,encounter:{kind:'tribulation' as const,elapsed:100}}
  const first=advanceAmbience(s,33,options)
  assert.ok(first.crane.y<0)
  assert.ok(Math.abs(first.crane.y-s.crane.y)<8)
  for(let i=0;i<90;i++){
    s=advanceAmbience(s,33,options)
    if(s.crane.x < -8)assert.ok(s.crane.y<=-30)
  }
  assert.ok(Math.abs(s.crane.y)<.001)
  s=advanceAmbience(s,33,normal);assert.equal(s.flightTime,33)
})
test('pause freezes position and clocks; reduced motion settles; incense has only one scene owner',()=>{
  const s={...createAmbience(),flightTime:15000,crane:craneFlight(15000)}
  assert.equal(advanceAmbience(s,5000,{...normal,paused:true}),s)
  assert.equal(advanceAmbience(s,NaN,normal),s)
  assert.equal(advanceAmbience(s,33,{...normal,reduced:true}).crane.y,0)
  assert.equal(showIncense('alchemy',false),false)
  assert.equal(showIncense('alchemy',true),true)
  assert.equal(showIncense('breath',false),true)
})
test('a manual interaction takes the crane back from a paused spirit visit',()=>{
  const s={...createAmbience(),crane:{...craneFlight(0),x:-15}}
  const next=advanceAmbience(s,33,{...normal,active:true,encounter:{kind:'spirit-visit',elapsed:5500}})
  assert.ok(next.crane.x>s.crane.x)
  assert.equal(next.crane.y,0)
  assert.equal(next.flightTime,0)
})
