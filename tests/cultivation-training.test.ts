import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceTraining, createTraining, shuffleTraining, trainingPose, trainingInterval, chooseDifferent, startEncounter, encounterPhase, encounterCaption, ENCOUNTER_DURATION, ENCOUNTERS, eligibleEncounters, chooseEncounter, encounterDuration, encounterActorPose, practiceForEncounter, REALMS, PRACTICES, islandForRealm } from '../src/cultivation/training.ts'
import { validateSettings } from '../src/shared/settings.ts'
import { DEFAULT_SETTINGS } from '../src/shared/types.ts'
const running={paused:false,random:true,reduced:false}
test('random practice and realm avoid immediate repetition over repeated cycles',()=>{
 let s=createTraining('sunny',()=>0)
 for(let i=0;i<50;i++){
  const next=shuffleTraining(s,true,()=>((i*37)%100)/100)
  assert.notEqual(next.realm,s.realm);assert.notEqual(next.practice,s.practice)
  assert.ok(REALMS.includes(next.realm));assert.ok(PRACTICES.some(p=>p.id===next.practice))
  assert.ok(next.remaining>=24000&&next.remaining<42000);assert.equal(next.elapsed,0);s=next
 }
 assert.equal(trainingInterval(()=>0),24000);assert.ok(trainingInterval(()=>1)<42000)
 assert.equal(chooseDifferent(['a'],'a',()=>NaN),'a')
})
test('interactions, panels, window movement and hidden pages pause the scheduler without catchup',()=>{
 const s={...createTraining('sunny'),elapsed:1000,remaining:100}
 assert.equal(advanceTraining(s,50000,{...running,paused:true}),s)
 assert.equal(advanceTraining(s,100,{...running,reduced:true}),s)
 assert.equal(advanceTraining(s,NaN,running),s)
 assert.equal(advanceTraining(s,-1,running),s)
 const resumed=advanceTraining({...s,remaining:5000},50000,running)
 assert.equal(resumed.elapsed,1250);assert.equal(resumed.remaining,4750)
 const next=advanceTraining(s,100,running,()=>.5)
 assert.equal(next.sequence,s.sequence+1);assert.notEqual(next.realm,s.realm)
})
test('fixed scene never rolls automatically but manual next practice preserves its realm',()=>{
 const s={...createTraining('rain'),remaining:1}
 const next=advanceTraining(s,200,{...running,random:false})
 assert.equal(next.realm,'rain');assert.equal(next.practice,s.practice);assert.equal(next.remaining,1);assert.equal(next.elapsed,200)
 const manual=shuffleTraining(next,false,()=>.5)
 assert.equal(manual.realm,'rain');assert.notEqual(manual.practice,next.practice)
})
test('training changes real sprite poses but preserves low, empty and unknown quota semantics',()=>{
 for(const practice of PRACTICES){
  const poses=new Set([0,1500,3200,4800,5800].map(t=>trainingPose('full',practice.id,t,false)))
  assert.deepEqual([...poses].sort(),[0,4,5])
  for(const t of [0,2000,4500,999999]){
   assert.equal(trainingPose('low',practice.id,t,false),2)
   assert.equal(trainingPose('empty',practice.id,t,false),3)
   assert.equal(trainingPose('unknown',practice.id,t,false),0)
  }
 }
 assert.equal(trainingPose('settling','breath',0,false),1)
 assert.equal(trainingPose('full','breath',7000,true),4)
 assert.deepEqual(REALMS.map(islandForRealm),[0,1,2,3])
})
test('wardrobe, accessories and random preferences validate independently and migrate old settings',()=>{
 assert.equal(DEFAULT_SETTINGS.cultivationRandom,true)
 for(const cultivationSkin of ['classic','azure','astral','crimson'])assert.equal(validateSettings({cultivationSkin}).cultivationSkin,cultivationSkin)
 for(const cultivationAccessory of ['none','lotus','moon','blossom'])assert.equal(validateSettings({cultivationAccessory}).cultivationAccessory,cultivationAccessory)
 for(const cultivationTreasure of ['none','gourd','jade','pouch'])assert.equal(validateSettings({cultivationTreasure}).cultivationTreasure,cultivationTreasure)
 assert.deepEqual(validateSettings({cultivationRandom:'true',cultivationSkin:'bad',cultivationAccessory:1,cultivationTreasure:'bad'}),{})
 const next={...DEFAULT_SETTINGS,...validateSettings({hamsterSkin:'winter',buddySkin:'worker',windowWidth:300,theme:'night'}),...validateSettings({cultivationSkin:'crimson',cultivationAccessory:'moon',cultivationTreasure:'jade',cultivationRandom:false})}
 assert.equal(next.hamsterSkin,'winter');assert.equal(next.buddySkin,'worker');assert.equal(next.theme,'night');assert.equal(next.windowWidth,300);assert.equal(next.cultivationRandom,false)
})


test('random encounters arise within a practice, progress through phases and return to the same world',()=>{
 for(const {id:kind} of ENCOUNTERS){
  const rng=()=>.5
  const original={...createTraining('rain',rng),practice:'alchemy' as const,elapsed:3800,remaining:1,encounterRemaining:1}
  let s=startEncounter(original,kind)
  assert.equal(s.encounter?.kind,kind);assert.equal(s.realm,'rain');assert.equal(s.practice,'alchemy')
  assert.equal(encounterPhase(s.encounter!),'gather')
  assert.ok(encounterCaption(s.encounter!).length>0)
  const frozen={elapsed:s.elapsed,remaining:s.remaining}
  const duration=encounterDuration(s.encounter!)
  while(s.encounter!.elapsed<duration*.24)s=advanceTraining(s,100,running,rng)
  assert.equal(encounterPhase(s.encounter!),'release')
  assert.deepEqual({elapsed:s.elapsed,remaining:s.remaining},frozen)
  while(s.encounter!.elapsed<duration*.76)s=advanceTraining(s,100,running,rng)
  assert.equal(encounterPhase(s.encounter!),'settle')
  while(s.encounter)s=advanceTraining(s,100,running,rng)
  assert.equal(s.encounter,null);assert.equal(s.realm,original.realm);assert.equal(s.practice,original.practice)
  assert.ok(s.encounterRemaining>=26000 && s.encounterRemaining<46000)
 }
})
test('encounters pause for interactions and panels; quiet mode finishes an existing event without restarting it',()=>{
 const s=startEncounter(createTraining('sunny'),'tribulation')
 assert.equal(advanceTraining(s,1000,{...running,paused:true}),s)
 let quiet={...s,encounter:{kind:'tribulation' as const,elapsed:ENCOUNTER_DURATION-100}}
 const done=advanceTraining(quiet,100,{...running,reduced:true})
 assert.equal(done.encounter,null)
 assert.equal(advanceTraining(done,100,{...running,reduced:true}),done)
 assert.equal(shuffleTraining(s).encounter,null)
 const fixed={...createTraining('rain'),encounterRemaining:1}
 assert.equal(advanceTraining(fixed,100,{...running,random:false}).encounter,null)
 assert.equal(createTraining('tribulation').realm,'thunder');assert.equal(createTraining('enlightened').realm,'sunny')
})


test('weighted events match the active practice, include every story and avoid consecutive repetition',()=>{
 const seen=new Set<string>()
 for(const {id:practice} of PRACTICES){
  const eligible=eligibleEncounters(practice).map(event=>event.id)
  for(let i=0;i<1000;i++){
   const kind=chooseEncounter(practice,null,()=>i/1000);seen.add(kind)
   assert.ok(eligible.includes(kind))
   assert.notEqual(chooseEncounter(practice,kind,()=>i/1000),kind)
   if(kind==='runaway-sword')assert.equal(practice,'sword')
   if(kind==='golden-pill'||kind==='furnace-pop')assert.equal(practice,'alchemy')
   if(kind==='drowsy')assert.ok(practice==='breath'||practice==='stargaze')
  }
  for(const n of [NaN,Infinity,-3,8])assert.ok(eligible.includes(chooseEncounter(practice,null,()=>n)))
 }
 assert.deepEqual([...seen].sort(),ENCOUNTERS.map(event=>event.id).sort())
 const total=ENCOUNTERS.reduce((sum,event)=>sum+event.weight,0)
 assert.ok(ENCOUNTERS.filter(event=>['tribulation','enlightenment'].includes(event.id)).reduce((sum,event)=>sum+event.weight,0)/total<.15)
})
test('automatic practice-specific event waits for a settled practice and never replaces its world',()=>{
 let s={...createTraining('night'),practice:'alchemy' as const,elapsed:1000,remaining:15000,encounterRemaining:0}
 const early=advanceTraining(s,100,running,()=>.4)
 assert.equal(early.encounter,null)
 const fired=advanceTraining({...s,elapsed:4000},100,running,()=>.6)
 assert.equal(fired.encounter?.kind,'furnace-pop')
 assert.equal(fired.realm,s.realm);assert.equal(fired.practice,s.practice)
 assert.equal(fired.encounterSequence,s.encounterSequence+1)
 const replay=startEncounter(fired,'furnace-pop')
 assert.equal(replay.encounterSequence,fired.encounterSequence+1);assert.equal(replay.encounter?.elapsed,0)
})
test('all event poses preserve low, zero and unknown quota expressions and previews choose matching practices',()=>{
 for(const {id:kind,duration} of ENCOUNTERS){
  for(const elapsed of [0,duration*.4,duration*.9]){
   const event={kind,elapsed}
   assert.equal(encounterActorPose(event,'low'),2)
   assert.equal(encounterActorPose(event,'empty'),3)
   assert.equal(encounterActorPose(event,'unknown'),0)
   assert.ok([0,4,5].includes(encounterActorPose(event,'full')))
  }
  for(const {id:practice} of PRACTICES){
   const selected=practiceForEncounter(kind,practice)
   assert.ok(eligibleEncounters(selected).some(event=>event.id===kind))
  }
 }
})
