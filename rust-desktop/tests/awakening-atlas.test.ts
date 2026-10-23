import {test} from 'node:test'
import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {AWAKENING_ATLASES,awakeningAtlas,energyFrame} from '../src/evolution/atlas'
import {AWAKENING_WARDROBES} from '../src/evolution/wardrobe'
import {petQuotaIndex} from '../src/shared/petQuota'
import type {Scene} from '../src/shared/types'
test('every supported costume and both Skadi forms have separate complete artwork',()=>{
 let count=0
 for(const [scene,skins] of Object.entries(AWAKENING_WARDROBES))for(const skin of Object.keys(skins))for(const form of scene==='skadi'?['chibi','adult']:['chibi']){
  // Basketball uses a live SVG costume; its independent palettes are browser-verified.
  if(scene==='basketball')continue
  const atlas=awakeningAtlas(scene as Scene,skin,form);assert.ok(atlas,`${scene}/${skin}/${form}`);count++
  assert.ok(existsSync(new URL('../public/assets/evolution/v2/'+atlas.file,import.meta.url)))
  assert.ok(atlas.rects.length>=4)
  for(const [x,y,w,h] of atlas.rects){assert.ok(w!>20&&h!>20);assert.ok(x!>=0&&y!>=0&&x!+w!<=atlas.size[0]!&&y!+h!<=atlas.size[1]!)}
 }
 assert.equal(count,85);assert.equal(Object.keys(AWAKENING_ATLASES).length,count)
 assert.equal(awakeningAtlas('fox','missing'),undefined)
 assert.equal(awakeningAtlas('skadi','classic','unknown'),undefined)
})
test('quota boundaries match existing pet states and unknown never selects full',()=>{
 for(const count of [4,5,6]){
  for(const value of [-1,0,10,25,50,75,100,150,...Array.from({length:count},(_,i)=>100*i/count)])assert.equal(energyFrame(value,count),petQuotaIndex(value,count),`${value}/${count}`)
  assert.equal(energyFrame(null,count),1);assert.equal(energyFrame(NaN,count),1)
 }
})
test('repaired buddy rows are individually mapped instead of a merged holiday/midnight costume',()=>{
 assert.equal(awakeningAtlas('buddy','holiday')?.file,'buddy-extra.png')
 assert.equal(awakeningAtlas('buddy','midnight')?.file,'buddy-extra.png')
 assert.notDeepEqual(awakeningAtlas('buddy','holiday')?.rects,awakeningAtlas('buddy','midnight')?.rects)
})
