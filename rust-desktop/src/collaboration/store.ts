import { reactive } from 'vue'
import type { Transport } from './bridge'
import { emptyConnection, mergeMessages, type Connection, type Room, type Member, type Agent, type Message, type Task } from './model'

export function createCollaborationStore(transport: Transport) {
  const state = reactive({ connection:emptyConnection(), rooms:[] as Room[], roomId:'', members:[] as Member[], agents:[] as Agent[], messages:[] as Message[], tasks:[] as Task[], context:{body:'',version:0}, loading:false, busy:false, error:'', notice:'', refreshedAt:0, messageCursor:0, epoch:0, drafts:{} as Record<string,string>, replyId:'' })
  let refreshSequence=0
  const pending=new Map<string,{body:string;reply:string;key:string}>()
  const key=()=>`${state.connection.session_key}|${state.roomId}`
  const current=(epoch:number,room:string)=>epoch===state.epoch && room===state.roomId
  function clearRoom() { state.notice='';state.loading=false;state.messages=[];state.members=[];state.agents=[];state.tasks=[];state.context={body:'',version:0};state.replyId='';state.refreshedAt=0;state.messageCursor=0 }
  function clearSession() { state.epoch++;state.roomId='';state.rooms=[];state.drafts={};pending.clear();clearRoom() }
  function failure(e:unknown,epoch:number) {
    if (epoch!==state.epoch) return
    state.error=String(e instanceof Error?e.message:e)
    if (/^401[:：]/.test(state.error)) { clearSession();state.connection=emptyConnection() }
    else if (/^403[:：]/.test(state.error)) { state.epoch++;state.roomId='';clearRoom() }
  }
  async function request<T>(method:string,path:string,body?:unknown,session=state.connection.session_key):Promise<T> {
    return transport<T>('request',{method,path,...(body===undefined?{}:{body}),session_key:session})
  }
  async function loadRooms() {
    const epoch=state.epoch
    const rooms=await request<Room[]>('GET','/v1/rooms')
    if(epoch!==state.epoch)return
    state.rooms=rooms.filter(r=>r.status==='active')
    if(state.roomId && !state.rooms.some(r=>r.id===state.roomId)){state.epoch++;state.roomId='';clearRoom()}
  }
  async function selectRoom(id:string) {
    if (!state.rooms.some(r=>r.id===id)) return
    state.epoch++;state.roomId=id;state.error='';clearRoom()
    const epoch=state.epoch
    await refresh()
    if (!current(epoch,id)) return
    try { const conn=await transport<Connection>('selectRoom',{room_id:id,session_key:state.connection.session_key});if(current(epoch,id))state.connection=conn } catch(e) {failure(e,epoch)}
  }
  async function restore() {
    clearSession();state.loading=true;state.error=''
    try {state.connection=await transport<Connection>('restore');state.error=state.connection.error||'';if(state.connection.user){await loadRooms();await selectRoom(state.rooms.find(r=>r.id===state.connection.last_room_id)?.id||state.rooms[0]?.id||'')}} catch(e){state.error=String(e)} finally{state.loading=false}
  }
  async function connect(payload:Record<string,unknown>) {
    if(state.busy)return
    state.busy=true;clearSession();state.connection=emptyConnection();state.error=''
    try {state.connection=await transport<Connection>('connect',payload);await loadRooms();await selectRoom(state.rooms.find(r=>r.id===state.connection.last_room_id)?.id||state.rooms[0]?.id||'')}catch(e){state.error=String(e instanceof Error?e.message:e)}finally{state.busy=false}
  }
  async function disconnect() {
    if(state.busy)return
    state.busy=true
    try {const conn=await transport<Connection>('disconnect',{session_key:state.connection.session_key});clearSession();state.connection=conn;state.notice=conn.remote_revoked?'已退出协作账户':'本机凭据已清除；服务端未确认登出，远端会话将按有效期失效'}catch(e){state.error=String(e)}finally{state.busy=false}
  }
  async function refresh() {
    if(!state.roomId||!state.connection.user)return
    const epoch=state.epoch,room=state.roomId,seq=++refreshSequence,session=state.connection.session_key
    state.loading=true
    try {
      const [members,agents,tasks,context,messages]=await Promise.all([
        request<Member[]>('GET',`/v1/rooms/${room}/members`,undefined,session),request<Agent[]>('GET',`/v1/rooms/${room}/agents`,undefined,session),
        request<Task[]>('GET',`/v1/rooms/${room}/tasks`,undefined,session),request<{body:string;version:number}|null>('GET',`/v1/rooms/${room}/context`,undefined,session),
        request<Message[]>('GET',`/v1/rooms/${room}/messages?after_seq=${state.messageCursor}&limit=200`,undefined,session),
      ])
      if(!current(epoch,room)||seq!==refreshSequence)return
      state.members=members;state.agents=agents;state.tasks=tasks;state.context=context??{body:'',version:0}
      state.messages=mergeMessages(state.messages,messages);state.messageCursor=messages.at(-1)?.seq??state.messageCursor;state.refreshedAt=Date.now();state.error=''
    }catch(e){if(seq===refreshSequence)failure(e,epoch)}finally{if(current(epoch,room)&&seq===refreshSequence)state.loading=false}
  }
  async function act(fn:()=>Promise<void>) {
    if(state.busy)return
    const epoch=state.epoch;state.busy=true;state.error='';state.notice=''
    try{await fn()}catch(e){failure(e,epoch)}finally{state.busy=false}
  }
  async function send() {
    const room=state.roomId,epoch=state.epoch,k=key(),body=(state.drafts[k]||'').trim(),reply=state.replyId
    if(!room||!body||body.length>20000)return
    let item=pending.get(k)
    if(!item||item.body!==body||item.reply!==reply){item={body,reply,key:crypto.randomUUID()};pending.set(k,item)}
    const sent=item
    await act(async()=>{
      const message=await request<Message>('POST',`/v1/rooms/${room}/messages`,{body,reply_to_id:reply||null,idempotency_key:sent.key})
      pending.delete(k)
      if(!current(epoch,room))return
      if((state.drafts[k]||'').trim()===body)state.drafts[k]=''
      state.messages=mergeMessages(state.messages,[message]);state.replyId='';state.notice='消息已保存。Agent 需要在对应宿主中手动触发读取。'
    })
  }
  async function createRoom(name:string) {
    await act(async()=>{const room=await request<Room>('POST','/v1/rooms',{name:name.trim()});await loadRooms();await selectRoom(room.id);state.notice='项目已创建。添加成员和 Agent 后即可开始协作。'})
  }
  return {state,key,request,restore,connect,disconnect,refresh,loadRooms,selectRoom,send,createRoom,act}
}
