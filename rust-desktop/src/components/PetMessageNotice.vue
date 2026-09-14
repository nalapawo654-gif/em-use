<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { PhX, PhBellSlash } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop } from '../bridge'
import { MESSAGE_PERSONAS, claimArrival, messageWindowError } from '../shared/messageNotice'
import MessageParcel from './MessageParcel.vue'
import CharacterMessageParcel from './CharacterMessageParcel.vue'
import { useCharacterMail } from '../shared/characterMail'
const mail=useCharacterMail()
const illustratedScenes = new Set(['feidudu', 'cultivation', 'beaver', 'hamster', 'dinosaur', 'skadi'])
import MessageInbox from './MessageInbox.vue'
const props=defineProps<{blocked?:boolean;deferred?:boolean}>()
const emit=defineEmits<{openChange:[value:boolean]; bubbleChange:[value:boolean]}>()
const host=ref<HTMLElement>(), trigger=ref<HTMLButtonElement>(), opened=ref(false), opening=ref(false), bubble=ref<string>(), hovering=ref(false), error=ref('')
const persona=computed(()=>MESSAGE_PERSONAS[state.settings.scene])
const current=computed(()=>state.messages?.items.find(i=>i.key===bubble.value))
const count=computed(()=>state.messages?.newCount ?? 0)
const visible=computed(()=>state.settings.messageEnabled && (!!state.messages?.items.length || state.messages?.status==='paused'))
watch([visible,()=>props.blocked],()=>{if(mail)mail.enabled.value=visible.value&&!props.blocked},{immediate:true,flush:'sync'})
const embedded=computed(()=>!!mail?.active.value&&mail.painted.value)
const paused=computed(()=>state.messages?.status==='paused' || state.settings.messagePausedUntil>Date.now())
const mutedPreview=computed(()=>!state.settings.messagePreview)
let remaining=5000,last=Date.now(),parent:HTMLElement|null=null,timer:ReturnType<typeof setInterval>|undefined
const inert=new Map<HTMLElement,boolean>()
function release(){for(const [el,before] of inert)el.inert=before;inert.clear();parent?.classList.remove('message-letter-open')}
function collapse(){opened.value=false;bubble.value=undefined;void nextTick(()=>trigger.value?.focus({preventScroll:true}))}
function visibilityChanged(){if(!document.hidden&&state.messages&&!opened.value&&!props.blocked&&!props.deferred){const arrival=claimArrival(state.messages,paused.value);if(arrival){bubble.value=arrival.key;remaining=5000;last=Date.now()}}}
function panelClosed(){opened.value=false}
function panelOpened(){opened.value=true;bubble.value=undefined}
function toastClosed(){bubble.value=undefined}
let toastQueue=Promise.resolve()
let disposed=false
watch([()=>current.value?.key,()=>state.messages?.epoch,()=>props.blocked,()=>props.deferred,()=>state.settings.windowWidth,()=>state.settings.scene,visible,opened],()=>{
 if(!api.showMessageToast)return
 toastQueue=toastQueue.catch(()=>{}).then(async()=>{
  if(!disposed&&current.value&&!props.blocked&&!props.deferred&&visible.value&&!opened.value)await api.showMessageToast!(state.messages!.epoch,current.value.key)
  else await api.hideMessageToast?.()
 }).catch(()=>{error.value='消息气泡未能显示，请点击小道具查看。'})
},{immediate:true,flush:'post'})
function escape(e:KeyboardEvent){if(e.key==='Escape' && opened.value && (parent?.contains(e.target as Node)||e.target===document.body)){e.preventDefault();e.stopImmediatePropagation();collapse()}}
async function open(){
  if(opening.value)return
  bubble.value=undefined;error.value=''
  if(api.openMessagePanel){
    opening.value=true;opened.value=true
    try{await nextTick();await api.openMessagePanel()}
    catch(e){opened.value=false;error.value=`${messageWindowError(e)} 可重试，或从设置查看咚咚消息。`}
    finally{opening.value=false}
    return
  }
  opened.value=true
}
watch(()=>[state.messages?.epoch,state.messages?.revision,props.blocked,props.deferred,state.messages?.status,opened.value],()=>{
  if(props.blocked){opened.value=false;return}
  if(state.messages?.status!=='ready'){bubble.value=undefined;return}
  const arrival=claimArrival(state.messages,opened.value||document.hidden||paused.value||!!props.deferred)
  if(arrival){bubble.value=arrival.key;remaining=5000;last=Date.now()}
},{immediate:true})
watch(()=>state.messages?.epoch,()=>{opened.value=false;bubble.value=undefined;error.value=''},{flush:'sync'})
watch(()=>current.value, item=>{if(!item)bubble.value=undefined})
watch(()=>!!current.value, v=>emit('bubbleChange',v),{immediate:true,flush:'sync'})
watch(opened,async value=>{
  emit('openChange',value);release()
  if(value && parent && !isDesktop){parent.classList.add('message-letter-open');for(const e of parent.children)if(e instanceof HTMLElement && e!==host.value){inert.set(e,e.inert);e.inert=true}}
},{flush:'post'})
onMounted(()=>{document.addEventListener('visibilitychange',visibilityChanged);window.addEventListener('message-panel-closed',panelClosed);window.addEventListener('message-toast-closed',toastClosed);window.addEventListener('message-panel-opened',panelOpened);parent=host.value?.parentElement??null;document.addEventListener('keydown',escape,true);timer=setInterval(()=>{const now=Date.now(),delta=now-last;last=now;if(!api.showMessageToast&&bubble.value&&!hovering.value&&!document.hidden&&!props.blocked&&!props.deferred&&!host.value?.querySelector(':focus-visible')){remaining-=Math.min(delta,500);if(remaining<=0)bubble.value=undefined}},100)})
onUnmounted(()=>{disposed=true;document.removeEventListener('visibilitychange',visibilityChanged);window.removeEventListener('message-panel-closed',panelClosed);window.removeEventListener('message-toast-closed',toastClosed);window.removeEventListener('message-panel-opened',panelOpened);void api.hideMessageToast?.();clearInterval(timer);release();document.removeEventListener('keydown',escape,true);emit('openChange',false);emit('bubbleChange',false)})
</script>
<template>
  <div ref="host" v-show="visible && !blocked" class="pet-message-notice" :class="[`message-${state.settings.scene}`, `message-motion-${persona.motion}`,{ 'has-message-bubble':!!current&&!deferred, 'message-embedded':embedded, 'message-open':opened, 'message-paused':paused, 'message-gentle':state.settings.reducedMotion }]" :style="{ '--msg-color':persona.color }" data-pet-gesture @pointerdown.stop @click.stop @contextmenu.stop.prevent @wheel.stop @mouseenter="hovering=true" @mouseleave="hovering=false">
    <template v-if="!opened || isDesktop">
      <button ref="trigger" class="message-launcher" :style="embedded ? mail?.position.value : undefined" :data-mail-pose="embedded ? mail?.pose.value : undefined" :aria-label="`${persona.object}，${count} 条新提醒，查看咚咚消息`" :aria-expanded="opened" @click="open"><span v-if="embedded" class="character-mail-art embedded-mail" data-ready="true" aria-hidden="true"/><slot v-else name="parcel"><CharacterMessageParcel v-if="illustratedScenes.has(state.settings.scene)" :key="state.settings.scene" :scene="state.settings.scene"/><MessageParcel v-else :scene="state.settings.scene"/></slot><span v-if="count&&!paused" class="message-count">{{ count>99?'99+':count }}</span><PhBellSlash v-if="paused" class="message-muted-badge"/><span class="message-launcher-tooltip">{{paused?'提醒已暂停':'查看消息 · 卡片内打开咚咚'}}</span></button>
      <div v-if="current && !paused && !deferred && !api.showMessageToast" class="message-bubble"><button class="message-bubble-content" @click="open"><b>咚咚 · {{ mutedPreview ? '新消息' : current.sender }}<span v-if="current.mentioned&&!mutedPreview" class="message-mention">@我</span></b><span>{{mutedPreview?'你收到了一条新消息':current.body}}</span></button><button class="message-bubble-close" aria-label="收起消息气泡" @click="bubble=undefined"><PhX/></button></div>
    </template>
    <MessageInbox v-else closeable @close="collapse"/>
    <p v-if="error" class="message-error" role="alert">{{error}}</p>
  </div>
</template>
