import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dinosaurTransformationTime } from '../src/dinosaur/transformation.js'
import atlas from '../src/dinosaur/transformation-atlas.json'

test('dinosaur storyboard follows authored beat boundaries and reverses to the original',()=>{
  for(const [ms,beat] of [[0,'gather'],[299,'gather'],[300,'grow'],[799,'grow'],[800,'reveal'],[1299,'reveal'],[1300,'settle']] as const){
    assert.equal(dinosaurTransformationTime(ms,1600).beat,beat)
  }
  assert.deepEqual(dinosaurTransformationTime(1600,1600),{t:1,progress:1,beat:'settle',done:true})
  assert.equal(dinosaurTransformationTime(0,600,true).t,1)
  assert.equal(dinosaurTransformationTime(600,600,true).t,0)
  assert.equal(dinosaurTransformationTime(-100,1600).t,0)
  assert.equal(dinosaurTransformationTime(1700,1600).t,1)
})
test('four costumes each have six complete key poses within the shipped RGBA atlas',()=>{
  const png=readFileSync(new URL(`../public/assets/evolution/v3/${atlas.file}`,import.meta.url))
  assert.equal(png.readUInt32BE(16),atlas.size[0]);assert.equal(png.readUInt32BE(20),atlas.size[1]);assert.equal(png[25],6)
  assert.deepEqual(Object.keys(atlas.rows),['classic','peach','cream','charcoal'])
  for(const row of Object.values(atlas.rows)){
    assert.equal(row.length,6)
    for(const [x,y,w,h] of row){assert.ok(x!>=0&&y!>=0&&w!>180&&h!>200);assert.ok(x!+w!<=atlas.size[0]!&&y!+h!<=atlas.size[1]!)}
  }
})
