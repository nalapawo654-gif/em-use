import test from 'node:test'
import assert from 'node:assert/strict'
import { DINOSAUR_ACTIONS, advanceDinosaur, beginDinosaur, dinosaurFrame, dinosaurLevel } from '../src/dinosaur/play.ts'
import { DINOSAUR_SKINS, DEFAULT_SETTINGS } from '../src/shared/types.ts'
import { validateSettings } from '../src/shared/settings.ts'
import { dinosaurMatte, DINOSAUR_CROPS } from '../src/dinosaur/sprites.ts'
import { tintDinosaurPixels } from '../src/dinosaur/skins.ts'

test('dinosaur quota boundaries distinguish exhausted from unknown', () => {
  assert.deepEqual([100,80.01,80,60.01,60,20.01,20,16,0,-1,null,NaN,Infinity].map(dinosaurLevel), ['full','full','tea','tea','tired','tired','low','low','empty','empty','unknown','unknown','unknown'])
  assert.deepEqual([100,70,50,20,15,null].map(p => dinosaurFrame(p)), [0,1,2,3,4,0])
})
test('short dinosaur actions expire exactly, sustained poses cancel, replacement owns its clock', () => {
  for (const item of DINOSAUR_ACTIONS) {
    const play = beginDinosaur(item.id, 100)
    if (item.duration !== null) {
      assert.equal(advanceDinosaur(play, 99 + item.duration).action, item.id)
      assert.equal(advanceDinosaur(play, 100 + item.duration).action, 'idle')
    } else assert.equal(advanceDinosaur(play, 999999).action, item.id)
    assert.equal(dinosaurFrame(0, item.id), item.frame)
    assert.equal(beginDinosaur('idle',1000).action,'idle')
  }
  const next = beginDinosaur('cookie',3000)
  assert.equal(advanceDinosaur(next,5000),next)
  assert.equal(dinosaurFrame(20,advanceDinosaur(next,7000).action),3)
  assert.equal(dinosaurFrame(null,advanceDinosaur(next,7000).action),0)
})
test('dinosaur preferences migrate independently and reject invalid values', () => {
  for (const skin of DINOSAUR_SKINS) assert.equal(validateSettings({ dinosaurSkin: skin.id }).dinosaurSkin,skin.id)
  assert.deepEqual(validateSettings({ dinosaurSkin:'bogus',scene:'bogus' }),{})
  const prior={...DEFAULT_SETTINGS,foxSkin:'jade',windowWidth:190,clickThrough:true}
  const next={...prior,...validateSettings({scene:'dinosaur',dinosaurSkin:'peach'})}
  assert.equal(next.scene,'dinosaur');assert.equal(next.dinosaurSkin,'peach');assert.equal(next.foxSkin,'jade');assert.equal(next.windowWidth,190);assert.equal(next.clickThrough,true)
  assert.equal({...DEFAULT_SETTINGS,...validateSettings({scene:'aquarium'})}.dinosaurSkin,'classic')
})
test('keyed dinosaur crops are bounded and preserve body, cream belly, spikes and props', () => {
  assert.equal(dinosaurMatte(255,0,255),1)
  for (const [r,g,b] of [[130,210,105],[250,238,194],[250,183,65],[130,143,221],[150,150,150]]) assert.equal(dinosaurMatte(r!,g!,b!),0)
  assert.equal(DINOSAUR_CROPS.length,9)
  for (const [x,y,w,h] of DINOSAUR_CROPS) assert.ok(x>=0&&y>=0&&x+w<=1254&&y+h<=1254)
})
test('four skins preserve alpha and all non-green colors', () => {
  const original=[130,210,105,180,250,238,194,255,250,183,65,255,130,143,221,255,150,150,150,255,12,8,5,255,130,210,105,0]
  for (const skin of DINOSAUR_SKINS) {
    const pixels=new Uint8ClampedArray(original);tintDinosaurPixels(pixels,skin.id)
    assert.equal(pixels[3],180);assert.deepEqual([...pixels.slice(4)],original.slice(4))
    if (skin.id==='classic') assert.deepEqual([...pixels],original)
    else assert.notDeepEqual([...pixels.slice(0,3)],original.slice(0,3))
  }
})
