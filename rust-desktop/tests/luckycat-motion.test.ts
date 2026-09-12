import test from 'node:test'
import assert from 'node:assert/strict'
import { CAT_DURATIONS, catMotionDelay, catMotionPool, catPose, chooseCatMotion } from '../src/luckycat/motion'
import { LUCKYCAT_ACTIONS } from '../src/luckycat/play'
import { catBackgroundMask, catPartBounds } from '../src/luckycat/sprites'
import { DEFAULT_SETTINGS, LUCKYCAT_SKINS } from '../src/shared/types'
import { validateSettings } from '../src/shared/settings'
test('animation timing matches manual actions and safely returns limbs to rest',()=>{
 for(const action of LUCKYCAT_ACTIONS){
  if(action.duration!==null)assert.equal(action.duration,CAT_DURATIONS[action.id])
  const start=catPose(action.id,0),end=catPose(action.id,1)
  for(const key of ['left','right','headY','headAngle','stretch','cup'] as const)assert.ok(Math.abs(start[key]-end[key])<1e-8,`${action.id} ${key}`)
 }
})
test('wave, stretch and drink move distinct body joints',()=>{
 assert.ok(catPose('fortune',.4).left>100)
 const stretch=catPose('stretch',.5);assert.ok(stretch.stretch>.95&&stretch.yawn>.95&&stretch.left>150&&stretch.right< -150)
 const sip=catPose('coffee',.5);assert.ok(sip.cup>.95&&sip.right>50&&sip.rightLength<90&&sip.closed>.9)
})
test('gold leaves paw, reaches two apices and is caught each cycle',()=>{
 const values=Array.from({length:201},(_,i)=>catPose('toss',i/200).goldFlight)
 assert.equal(values[0],0);assert.equal(values.at(-1),0)
 const peaks=values.filter((v,i)=>i>0&&i<values.length-1&&v>values[i-1]!&&v>values[i+1]!&&v>.98)
 assert.equal(peaks.length,2)
 assert.ok(catPose('toss',.32).goldFlight>.9)
 assert.equal(catPose('toss',.44).goldFlight,0)
})
test('blink closes twice and gaze/rest do not change quota or garments',()=>{
 assert.ok(catPose('blink',.25).closed>.9);assert.ok(catPose('blink',.67).closed>.9);assert.equal(catPose('blink',.48).closed,0)
 assert.ok(Math.abs(catPose('listen',.5).headAngle)>5)
 assert.ok(catPose('doze',.5).closed>.9)
})
test('ambient pools respect unknown and empty and avoid consecutive repeats',()=>{
 assert.deepEqual(catMotionPool('unknown'),['blink','listen'])
 assert.deepEqual(catMotionPool('empty'),['blink','doze','listen'])
 for(const previous of catMotionPool('full'))assert.notEqual(chooseCatMotion(100,previous,()=>0),previous)
 assert.equal(catMotionDelay(()=>0),5000);assert.equal(catMotionDelay(()=>1),12000)
})
test('all four outfits validate and keep other pets selections',()=>{
 assert.equal(LUCKYCAT_SKINS.length,4)
 for(const skin of LUCKYCAT_SKINS){const s={...DEFAULT_SETTINGS,...validateSettings({luckycatSkin:skin.id})};assert.equal(s.luckycatSkin,skin.id);assert.equal(s.foxSkin,DEFAULT_SETTINGS.foxSkin)}
 assert.deepEqual(validateSettings({luckycatSkin:'invalid'}),{})
})
test('connected green background key preserves enclosed emerald jewel',()=>{
 const d=new Uint8ClampedArray(5*5*4)
 for(let y=0;y<5;y++)for(let x=0;x<5;x++){const border=!x||!y||x===4||y===4,jewel=x===2&&y===2;d.set(border||jewel?[0,255,0,255]:[250,100,40,255],(y*5+x)*4)}
 const mask=catBackgroundMask(d,5,5);assert.equal(mask[0],1);assert.equal(mask[12],0);assert.equal(mask[6],0)
})
test('part trim ignores neighboring-cell sliver instead of shifting the head',()=>{
 const d=new Uint8ClampedArray(10*10*4)
 for(let y=2;y<8;y++)for(let x=2;x<8;x++)d[(y*10+x)*4+3]=255
 d[(5*10+9)*4+3]=255
 assert.deepEqual(catPartBounds(d,10,10),[2,2,7,7])
})
