import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { POTATO_SKINS } from '../src/potato/catalog'
import { POTATO_ACTIONS, potatoLevel, potatoFrame, potatoIdle, beginPotato, tapPotato, advancePotato } from '../src/potato/play'
import { DEFAULT_SETTINGS, SCENE_LABELS } from '../src/shared/types'
import { validateSettings } from '../src/shared/settings'
import { CALENDAR_PROPS } from '../src/shared/calendarProps'
import { MESSAGE_PERSONAS } from '../src/shared/messageNotice'
import { UPDATE_PERSONAS } from '../src/shared/updateNotice'
test('all twenty reference skins have four unique dedicated armor frames and persist independently',()=>{
 assert.equal(POTATO_SKINS.length,20)
 assert.equal(new Set(POTATO_SKINS.map(s=>s.id)).size,20)
 const frames=new Set<string>()
 for(const skin of POTATO_SKINS){
  const settings={...DEFAULT_SETTINGS,...validateSettings({scene:'potato',potatoSkin:skin.id})}
  assert.equal(settings.scene,'potato');assert.equal(settings.potatoSkin,skin.id)
  assert.equal(settings.piranhaSkin,DEFAULT_SETTINGS.piranhaSkin)
  for(const [index,percent] of [100,75,50,25].entries()){
   const frame=potatoFrame(percent,skin.id)
   assert.equal(frame.atlas,skin.atlas);assert.equal(frame.frame,skin.row*4+index)
   frames.add(`${frame.atlas}:${frame.frame}`)
  }
  assert.deepEqual(potatoFrame(0,skin.id),potatoFrame(25,skin.id))
  assert.deepEqual(potatoFrame(null,skin.id),potatoFrame(100,skin.id))
 }
 assert.equal(frames.size,80)
 assert.deepEqual(validateSettings({potatoSkin:'missing'}),{})
 assert.equal(DEFAULT_SETTINGS.potatoSkin,'gundam')
 assert.equal(SCENE_LABELS.potato,'土豆战神')
})
test('quota transitions at 75, 50 and 25 including exact thresholds and unknown',()=>{
 assert.deepEqual([100,75.001,75,50.001,50,25.001,25,0,-1,null,NaN,Infinity].map(potatoLevel),['full','full','worn','worn','taped','taped','cardboard','cardboard','cardboard','unknown','unknown','unknown'])
})
test('short actions end, shield persists, and restoring idle uses the latest quota and skin',()=>{
 const quota=Object.freeze({percent:25,remaining:75})
 for(const action of POTATO_ACTIONS){
  const play=beginPotato(action.id,100)
  if(action.duration!==null){
   assert.equal(advancePotato(play,99+action.duration),play)
   assert.deepEqual(advancePotato(play,100+action.duration),potatoIdle())
  }else assert.equal(advancePotato(play,999999),play)
 }
 assert.deepEqual(beginPotato('idle',100),potatoIdle())
 assert.equal(potatoLevel(quota.percent),'cardboard');assert.equal(quota.remaining,75)
})
test('calculator and repairs require three distinct valid taps, then recover precisely',()=>{
 for(const action of ['calculate','repair'] as const){
  let play=beginPotato(action,100)
  for(const time of [NaN,Infinity,99])assert.equal(tapPotato(play,time),play)
  assert.equal(advancePotato(play,999999),play)
  play=tapPotato(play,100)
  assert.equal(tapPotato(play,339),play)
  play=tapPotato(play,340);assert.equal(play.steps,2);assert.equal(play.completedAt,null)
  play=tapPotato(play,580);assert.equal(play.steps,3);assert.equal(play.completedAt,580)
  assert.equal(tapPotato(play,9999),play)
  assert.equal(advancePotato(play,1679),play)
  assert.deepEqual(advancePotato(play,1680),potatoIdle())
  assert.equal(beginPotato('coffee',600).steps,0)
 }
 const shield=beginPotato('shield',0);assert.equal(tapPotato(shield,1000),shield)
})
test('new companion uses shared schedule, message and update personas',()=>{
 assert.equal(CALENDAR_PROPS.potato.name,'机甲日程终端')
 assert.equal(MESSAGE_PERSONAS.potato.object,'土豆通信信标')
 assert.equal(UPDATE_PERSONAS.potato.object,'机甲补给箱')
})

test('all twenty skins have installed native assets and sixteen valid crop rectangles per atlas',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../docs/native-assets.json',import.meta.url),'utf8'))
 const crops=JSON.parse(readFileSync(new URL('../src/potato/crops.json',import.meta.url),'utf8'))
 for(const atlas of new Set([...POTATO_SKINS.map(s=>s.atlas),'props'])){
  const entry=manifest.assets.find((a:{path:string})=>a.path===`potato/${atlas}-atlas.png`)
  assert.ok(entry,atlas)
  assert.ok(readFileSync(new URL(`../public/assets/${entry.path}`,import.meta.url)).length>0)
  assert.equal(crops[atlas].length,16)
  for(const [x,y,width,height] of crops[atlas]){
   assert.ok(x>=0&&y>=0&&width>0&&height>0)
   assert.ok(x+width<=entry.width&&y+height<=entry.height)
  }
 }
})
