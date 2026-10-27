import test from 'node:test'
import assert from 'node:assert/strict'
import { createCollaborationStore } from '../src/collaboration/store'
import { emptyConnection, normalizedOrigin, hostConfig, type Binding, type Message } from '../src/collaboration/model'
import type { Transport } from '../src/collaboration/bridge'

const user={id:'human',username:'owner',display_name:'负责人',is_admin:true}
const connection={...emptyConnection(),user,server_url:'https://room.test',session_key:'session',last_room_id:'a'}
const rooms=['a','b'].map(id=>({id,name:id,status:'active',role:'owner',created_at:''}))
const message=(id:string,seq:number):Message=>({id,seq,sender_user_id:'human',sender_agent_instance_id:null,reply_to_id:null,body:id,created_at:'',auto_reply:false})
function deferred<T>() {let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve}}
function setup(handler?:(path:string,p:Record<string,unknown>)=>unknown) {
  const calls:Record<string,unknown>[]=[]
  const transport=(async(action:string,p:Record<string,unknown>={})=>{
    calls.push({action,...p})
    if(action==='restore'||action==='connect'||action==='selectRoom')return {...connection,last_room_id:p.room_id||'a'}
    if(action==='disconnect')return emptyConnection()
    const path=String(p.path)
    if(handler){const v=handler(path,p);if(v!==undefined)return v}
    if(path==='/v1/rooms')return rooms
    if(path.endsWith('/context'))return null
    return []
  }) as Transport
  return {store:createCollaborationStore(transport),calls}
}

test('empty context is editable v0, and remembered project restores',async()=>{
  const {store}=setup();await store.restore()
  assert.equal(store.state.roomId,'a');assert.deepEqual({...store.state.context},{body:'',version:0})
})
test('late old-project responses never overwrite current project or cursor',async()=>{
  const wait=deferred<Message[]>();let delay=false
  const {store}=setup(path=>path.includes('/messages')?(delay&&path.includes('/a/')?wait.promise:[message(path,2)]):undefined)
  await store.restore();delay=true
  const old=store.refresh();await store.selectRoom('b');wait.resolve([message('old-a',900)]);await old
  assert.equal(store.state.roomId,'b');assert.equal(store.state.messageCursor,2)
  assert.ok(store.state.messages.every(m=>!m.id.includes('old-a')))
})
test('logout invalidates in-flight reads and clears private drafts',async()=>{
  const wait=deferred<Message[]>();let delay=false
  const {store}=setup(path=>path.includes('/messages')&&delay?wait.promise:undefined)
  await store.restore();store.state.drafts[store.key()]='private';delay=true
  const read=store.refresh();await store.disconnect();wait.resolve([message('secret',5)]);await read
  assert.equal(store.state.connection.user,null);assert.equal(store.state.messages.length,0);assert.deepEqual({...store.state.drafts},{})
})
test('ambiguous send retry reuses idempotency key and preserves unsent draft',async()=>{
  let attempts=0
  const {store,calls}=setup((path,p)=>{if(path.endsWith('/messages')&&p.method==='POST'){if(++attempts===1)throw Error('network');return message('sent',8)}})
  await store.restore();store.state.drafts[store.key()]='hello'
  await store.send();assert.equal(store.state.drafts[store.key()],'hello')
  await store.send();const sends=calls.filter(c=>c.method==='POST')
  assert.equal((sends[0].body as any).idempotency_key,(sends[1].body as any).idempotency_key)
  assert.equal(store.state.messages.length,1);assert.equal(store.state.drafts[store.key()],'')
})
test('sending a newer message never skips a concurrent agent message on next read',async()=>{
  let phase=0
  const {store,calls}=setup((path,p)=>{
    if(p.method==='POST')return message('mine',30)
    if(path.includes('/messages'))return phase++===0?[message('first',10)]:[message('agent',20),message('mine',30)]
  })
  await store.restore();store.state.drafts[store.key()]='hello';await store.send();await store.refresh()
  assert.deepEqual(store.state.messages.map(m=>m.seq),[10,20,30])
  assert.ok(calls.some(c=>String(c.path).includes('after_seq=10')))
})
test('membership loss removes visible room data; authentication loss clears account',async()=>{
  let code=0
  const {store}=setup(path=>{if(code&&path.includes('/messages'))throw Error(`${code}：denied`)})
  await store.restore();code=403;await store.refresh();assert.equal(store.state.roomId,'');assert.equal(store.state.messages.length,0);assert.equal(store.state.loading,false)
  code=0;await store.selectRoom('b');code=401;await store.refresh();assert.equal(store.state.connection.user,null);assert.equal(store.state.rooms.length,0)
})
test('project drafts remain separate and double-click sends only once',async()=>{
  const wait=deferred<Message>();const {store,calls}=setup((_path,p)=>p.method==='POST'?wait.promise:undefined)
  await store.restore();store.state.drafts[store.key()]='a draft';await store.selectRoom('b');assert.equal(store.state.drafts[store.key()],undefined)
  store.state.drafts[store.key()]='b draft';await store.selectRoom('a');assert.equal(store.state.drafts[store.key()],'a draft')
  const first=store.send();await store.send();wait.resolve(message('only',1));await first
  assert.equal(calls.filter(c=>c.method==='POST').length,1)
  assert.ok(!calls.some(c=>String(c.path).includes('/start')))
})
test('host configurations carry independent identity paths, never tokens; origins are restricted',()=>{
  const binding:Binding={id:'unique',server_url:'https://room.test',user_id:'u',room_id:'r',agent_id:'a',host_kind:'codex',host_ref:'project',scope:'project',label:'Agent',state_file:'/private/my profile/binding.json',executable:'/Apps/MCP/em-use-collab-mcp'}
  for(const host_kind of ['codex','dsh','aiwork','ide']){const config=hostConfig({...binding,host_kind});assert.ok(config.includes(binding.state_file));assert.ok(config.includes('keyring'));assert.ok(!config.includes('agent_token'))}
  assert.equal(normalizedOrigin('https://EXAMPLE.com:443/'),'https://example.com')
  for(const origin of ['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com?x=1'])assert.throws(()=>normalizedOrigin(origin))
})
