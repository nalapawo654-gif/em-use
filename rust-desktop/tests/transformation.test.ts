import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TRANSFORMATION_ATLASES, transformationTime, transformationEndFrame } from '../src/evolution/transformation.js'
import { AWAKENING_ATLASES } from '../src/evolution/atlas.js'
import { initialEvolution,stepEvolution } from '../src/evolution/state.js'
test('every remaining costume and Skadi form ships six unique in-bounds RGBA poses',()=>{
 const expected=Object.keys(AWAKENING_ATLASES).filter(k=>!k.startsWith('dinosaur/')).sort()
 assert.equal(expected.length,81);assert.deepEqual(Object.keys(TRANSFORMATION_ATLASES).sort(),expected)
 for(const [key,spec]of Object.entries(TRANSFORMATION_ATLASES)){
  const png=readFileSync(new URL(`../public/assets/evolution/v3/${spec.file}`,import.meta.url));assert.equal(png.readUInt32BE(16),spec.size[0],key);assert.equal(png.readUInt32BE(20),spec.size[1],key);assert.equal(png[25],6,key)
  assert.equal(spec.rects.length,6,key);assert.equal(new Set(spec.rects.map(r=>JSON.stringify(r))).size,6,key)
  for(const [x,y,w,h]of spec.rects){assert.ok(x!>=0&&y!>=0&&w!>50&&h!>50,key);assert.ok(x!+w!<=spec.size[0]!&&y!+h!<=spec.size[1]!,key)}
 }
})
test('storyboard beat boundaries, clamping and reversed restoration are deterministic',()=>{
 for(const [ms,beat]of [[0,'gather'],[299,'gather'],[300,'grow'],[799,'grow'],[800,'reveal'],[1299,'reveal'],[1300,'settle']]as const)assert.equal(transformationTime(ms,1600).beat,beat)
 assert.equal(transformationTime(-1,1600).t,0);assert.equal(transformationTime(1800,1600).t,1);assert.equal(transformationTime(0,600,true).t,1);assert.equal(transformationTime(600,600,true).t,0)
})
test('all awakened wardrobe changes reserve the complete storyboard; light and off stay short',()=>{
 for(const scene of new Set(Object.keys(TRANSFORMATION_ATLASES).map(k=>k.split('/')[0]!))){
  const input={source:'codex',scene,appearance:scene+'/a',enabled:true,ready:true,retain:true,blocked:false,hidden:false,motion:'full' as const}
  const initial=stepEvolution(initialEvolution(),input,0),next={...input,appearance:scene+'/b'}
  const playing=stepEvolution(initial,next,100);assert.equal(playing.duration,1600,scene);assert.notEqual(stepEvolution(playing,next,1500).phase,'idle',scene);assert.equal(stepEvolution(playing,next,1700).phase,'idle',scene)
  assert.equal(stepEvolution(initial,{...next,motion:'light'},100).duration,200,scene);assert.equal(stepEvolution(initial,{...next,motion:'off'},100).phase,'idle',scene)
 }
})

test('settling uses quota poses rather than interaction frames',()=>{
 assert.equal(transformationEndFrame('cultivation',0,6),3);assert.equal(transformationEndFrame('cultivation',40,6),2);assert.equal(transformationEndFrame('skadi',0,6),5);assert.equal(transformationEndFrame('skadi',80,6),0);assert.equal(transformationEndFrame('battery',0,6),5);assert.equal(transformationEndFrame('fox',null,4),1)
})
