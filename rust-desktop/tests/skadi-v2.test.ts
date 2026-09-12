import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS, SKADI_FORMS, SKADI_SKINS, SKADI_WEAPONS, skadiSelectedSkin } from '../src/shared/types'
import { validateSettings } from '../src/shared/settings'
import { skadiFishingPhase, skadiWeaponPower } from '../src/skadi/motion'
import { skadiVertex } from '../src/skadi/deform'
import { advanceSkadi, beginSkadi, SKADI_ACTIONS } from '../src/skadi/play'

test('both forms keep their own wardrobe while equipment and shared preferences survive switching', () => {
 let settings={...DEFAULT_SETTINGS,windowWidth:190,clickThrough:true}
 for(const weapon of SKADI_WEAPONS){
  settings={...settings,...validateSettings({skadiWeapon:weapon.id})}
  for(const form of SKADI_FORMS)for(const skin of SKADI_SKINS){
   const other=form.id==='adult'?'skadiSkin':'skadiAdultSkin',before=settings[other]
   settings={...settings,...validateSettings({skadiForm:form.id,[form.id==='adult'?'skadiAdultSkin':'skadiSkin']:skin.id})}
   assert.equal(skadiSelectedSkin(settings),skin.id)
   assert.equal(settings[other],before);assert.equal(settings.skadiWeapon,weapon.id)
   assert.equal(settings.windowWidth,190);assert.equal(settings.clickThrough,true)
  }
 }
 assert.deepEqual(validateSettings({skadiForm:'missing',skadiAdultSkin:'missing',skadiWeapon:'missing'}),{})
 const migrated={...DEFAULT_SETTINGS,...validateSettings({skadiSkin:'pajamas'})}
 assert.equal(migrated.skadiSkin,'pajamas');assert.equal(migrated.skadiAdultSkin,'classic')
})
test('fishing has a waiting period and finite catch window; equipment always returns to rest',()=>{
 assert.equal(skadiFishingPhase(2399),'waiting');assert.equal(skadiFishingPhase(2400),'bite')
 assert.equal(skadiFishingPhase(7499),'bite');assert.equal(skadiFishingPhase(7500),'missed')
 for(const item of SKADI_ACTIONS){const start=beginSkadi(item.id,100)
  if(item.duration!==null){const end=advanceSkadi(start,100+item.duration);assert.equal(end.action,'idle');assert.equal(skadiWeaponPower(end.action),'rest')}
 }
})
test('animated mesh keeps face stable and never folds triangles during gait or wave',()=>{
 for(const action of ['idle','walk','wave'] as const)for(let time=0;time<7;time+=.07){
  const face=skadiVertex(.5,.3,time,action);assert.ok(Math.abs(face[0]-.5)<.004&&Math.abs(face[1]-.3)<.004)
  for(let y=0;y<16;y++)for(let x=0;x<12;x++){
   const a=skadiVertex(x/12,y/16,time,action),b=skadiVertex((x+1)/12,y/16,time,action),c=skadiVertex((x+1)/12,(y+1)/16,time,action)
   assert.ok((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0)
  }
 }
})
