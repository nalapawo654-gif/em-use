import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SCENE_LABELS, type MessageState } from '../src/shared/types'
import { MESSAGE_PERSONAS, claimArrival, messageGroups, toastGroup } from '../src/shared/messageNotice'
const state=(epoch: string): MessageState=>({epoch,status:'ready',message:'',account:{id:'A',name:'消息 A'},revision:1,newCount:1,pausedUntil:0,items:[{key:'1',conversation:'c',sender:'张三',title:'张三',body:'message',kind:'text',at:1,fresh:true,mentioned:false}]})
test('every scene has an independent message prop and finite motion',()=>{assert.deepEqual(Object.keys(MESSAGE_PERSONAS).sort(),Object.keys(SCENE_LABELS).sort());assert.equal(new Set(Object.values(MESSAGE_PERSONAS).map(i=>i.object)).size,11);assert.equal(new Set(Object.values(MESSAGE_PERSONAS).map(i=>i.motion)).size,11)})
test('blocked arrivals wait, scene remounts do not replay, source switches reset',()=>{const s=state('A');assert.equal(claimArrival(s,true),undefined);assert.equal(claimArrival(s,false)?.key,'1');assert.equal(claimArrival(s,false),undefined);assert.equal(claimArrival(state('B'),false)?.key,'1')})
test('pause and already-viewed messages never create fresh bubbles',()=>{const s=state('paused');s.status='paused';assert.equal(claimArrival(s,false),undefined);s.status='ready';s.items[0].fresh=false;assert.equal(claimArrival(s,false),undefined)})
test('messages merge per conversation, not by sender display name',()=>{const s=state('groups');s.items.push({...s.items[0],key:'2'},{...s.items[0],key:'3',conversation:'other',fresh:false});const groups=messageGroups(s.items);assert.equal(groups.length,2);assert.equal(groups[0].fresh,2);assert.equal(groups[1].fresh,0)})
test('group messages from different senders share one card; same-name groups stay separate',()=>{
  const base=state('merged').items[0]
  const items=[
    {...base,key:'old',title:'旧群名',at:10},
    {...base,key:'other',conversation:'other',title:'项目讨论群',at:20},
    {...base,key:'latest',sender:'李四',title:'项目讨论群',at:30},
    {...base,key:'viewed',sender:'王五',title:'项目讨论群',at:25,fresh:false},
  ]
  const groups=messageGroups(items)
  assert.equal(groups.length,2)
  assert.equal(groups[0].title,'项目讨论群')
  assert.deepEqual(groups[0].items.map(i=>i.key),['latest','viewed','old'])
  assert.equal(groups[0].fresh,2)
  assert.equal(groups[1].id,'other')
  assert.deepEqual(items.map(i=>i.key),['old','other','latest','viewed'])
})

test('a conversation burst updates an open toast and stays quiet after it closes',()=>{
  const s=state('burst'), base=s.items[0]
  const add=(key:string,at:number)=>s.items.unshift({...base,key,at})
  assert.equal(claimArrival(s,false,undefined,100_000)?.key,'1')
  add('2',2)
  assert.equal(claimArrival(s,false,'c',101_000)?.key,'2')
  add('3',3)
  assert.equal(claimArrival(s,false,undefined,107_000),undefined)
  add('4',4)
  assert.equal(claimArrival(s,false,undefined,130_000),undefined) // rolling gap, not first-arrival cooldown
  add('5',5)
  assert.equal(claimArrival(s,false,undefined,160_000)?.key,'5')
  assert.equal(s.items.length,5)
  assert.ok(s.items.every(i=>i.fresh)) // suppressing a bubble never marks messages read
})
test('other conversations and fully viewed conversations get their own next arrival',()=>{
  const s=state('burst-boundaries'), base=s.items[0]
  claimArrival(s,false,undefined,100_000)
  s.items.unshift({...base,key:'2',at:2,conversation:'other'})
  assert.equal(claimArrival(s,false,undefined,101_000)?.conversation,'other')
  s.items.forEach(i=>i.fresh=false)
  claimArrival(s,false,undefined,102_000)
  s.items.unshift({...base,key:'3',at:3,fresh:true})
  assert.equal(claimArrival(s,false,undefined,103_000)?.key,'3')
})
test('deferred arrivals do not consume the burst allowance; source changes reset it',()=>{
  const s=state('burst-deferred')
  assert.equal(claimArrival(s,true,undefined,100_000),undefined)
  assert.equal(claimArrival(s,false,undefined,101_000)?.key,'1')
  assert.equal(claimArrival(state('burst-new-source'),false,undefined,102_000)?.key,'1')
})
test('a toast follows the newest message in its conversation after its anchor is removed',()=>{
  const s=state('toast-anchor'), base=s.items[0]
  s.items=[{...base,key:'3',at:3},{...base,key:'2',at:2},{...base,key:'4',conversation:'other',at:4}]
  const toast={epoch:s.epoch,key:'1',conversation:'c'}
  const group=toastGroup(s,toast)!
  assert.equal(group.items[0].key,'3');assert.equal(group.fresh,2)
  assert.equal(toastGroup(s,{...toast,epoch:'previous'}),undefined)
  assert.equal(toastGroup({...s,status:'paused'},toast),undefined)
  assert.equal(toastGroup(s,{epoch:s.epoch,key:'2'})?.id,'c')
})
