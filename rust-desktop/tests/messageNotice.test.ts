import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SCENE_LABELS, type MessageState } from '../src/shared/types'
import { MESSAGE_PERSONAS, claimArrival, messageGroups } from '../src/shared/messageNotice'
const state=(epoch: string): MessageState=>({epoch,status:'ready',message:'',account:{id:'A',name:'消息 A'},revision:1,newCount:1,pausedUntil:0,items:[{key:'1',conversation:'c',sender:'张三',title:'张三',body:'message',kind:'text',at:1,fresh:true,mentioned:false}]})
test('every scene has an independent message prop and finite motion',()=>{assert.deepEqual(Object.keys(MESSAGE_PERSONAS).sort(),Object.keys(SCENE_LABELS).sort());assert.equal(new Set(Object.values(MESSAGE_PERSONAS).map(i=>i.object)).size,11);assert.equal(new Set(Object.values(MESSAGE_PERSONAS).map(i=>i.motion)).size,11)})
test('blocked arrivals wait, scene remounts do not replay, source switches reset',()=>{const s=state('A');assert.equal(claimArrival(s,true),undefined);assert.equal(claimArrival(s,false)?.key,'1');assert.equal(claimArrival(s,false),undefined);assert.equal(claimArrival(state('B'),false)?.key,'1')})
test('pause and already-viewed messages never create fresh bubbles',()=>{const s=state('paused');s.status='paused';assert.equal(claimArrival(s,false),undefined);s.status='ready';s.items[0].fresh=false;assert.equal(claimArrival(s,false),undefined)})
test('messages merge per conversation, not by sender display name',()=>{const s=state('groups');s.items.push({...s.items[0],key:'2'},{...s.items[0],key:'3',conversation:'other',fresh:false});const groups=messageGroups(s.items);assert.equal(groups.length,2);assert.equal(groups[0].fresh,2);assert.equal(groups[1].fresh,0)})
