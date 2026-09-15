<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { api, appState as state } from '../bridge'
import { calendarTime, nextCalendarEvent } from '../shared/calendar'
import BuddyCalendarArt from './BuddyCalendarArt.vue'
import AquariumCalendarArt from './AquariumCalendarArt.vue'
import SceneCalendarArt from './SceneCalendarArt.vue'
import { CALENDAR_PROPS,type CalendarPropScene } from '../shared/calendarProps'
import type { Scene } from '../shared/types'
import CalendarCard from './CalendarCard.vue'
const props=withDefaults(defineProps<{appearance?:Scene;blocked?:boolean;deferred?:boolean}>(),{appearance:'buddy'})
const propSpec=computed(()=>CALENDAR_PROPS[props.appearance as CalendarPropScene])
const propStyle=computed(()=>{const s=propSpec.value;return s?{left:`${s.x}%`,top:`${s.y}%`,width:`${s.width}%`,height:`${s.height}%`}:undefined})
const emit=defineEmits<{openChange:[value:boolean]}>()
const open=ref(false),opening=ref(false),error=ref(''),time=ref(Date.now()),trigger=ref<HTMLButtonElement>()
const timer=setInterval(()=>time.value=Date.now(),1000)
const next=computed(()=>nextCalendarEvent(state.calendar,time.value))
const alert=computed(()=>!!state.calendar?.active.length)
const label=computed(()=>next.value?`${calendarTime(next.value.start)} · ${state.settings.calendarPreview?next.value.title:'一项日程'}`:state.calendar?.status==='ready'?'今天没有接下来的安排':state.calendar?.message||'查看今日日程')
function opened(){open.value=true}function closed(){open.value=false}
watch(open,value=>emit('openChange',value),{flush:'sync'})
watch(()=>[props.blocked,props.deferred,state.settings.calendarEnabled],()=>{void api.calendarUi?.(!!props.blocked).catch(()=>{})},{immediate:true})
watch(()=>state.calendar?.epoch,()=>{open.value=false;error.value=''})
async function show(){if(opening.value)return;error.value='';opening.value=true;try{if(api.openCalendar)await api.openCalendar();open.value=true}catch(e){error.value=String(e instanceof Error?e.message:e)}finally{opening.value=false}}
function close(){open.value=false;trigger.value?.focus({preventScroll:true})}
onMounted(()=>{window.addEventListener('calendar-panel-opened',opened);window.addEventListener('calendar-panel-closed',closed)})
onUnmounted(()=>{clearInterval(timer);window.removeEventListener('calendar-panel-opened',opened);window.removeEventListener('calendar-panel-closed',closed);emit('openChange',false);void api.calendarUi?.(false).catch(()=>{})})
</script>
<template>
 <div v-if="state.settings.calendarEnabled" v-show="!blocked" class="pet-calendar" :style="propStyle" :class="[`${appearance}-calendar`, {'calendar-gentle':state.settings.reducedMotion}]" data-pet-gesture @pointerdown.stop @click.stop @dblclick.stop @wheel.stop @contextmenu.stop.prevent>
  <button ref="trigger" class="pet-calendar-launcher" :class="`${appearance}-calendar-launcher`" :aria-label="`今日日程，${propSpec?propSpec.name+'，':''}${label}`" :aria-expanded="open" :disabled="opening" @click="show"><component :is="propSpec?SceneCalendarArt:appearance==='aquarium'?AquariumCalendarArt:BuddyCalendarArt" :scene="appearance" :time="next?calendarTime(next.start):'今日'" :alert="alert&&!deferred" :gentle="state.settings.reducedMotion"/><span class="calendar-launcher-tooltip">{{label}}</span><span v-if="state.calendar?.status==='stale'||state.calendar?.status==='expired'" class="calendar-sync-dot" aria-label="日程待同步"/></button>
  <div v-if="open&&!api.openCalendar" class="calendar-preview-panel"><CalendarCard closeable @close="close"/></div>
  <p v-if="error" class="calendar-prop-error" role="alert">{{error}}<button @click="show">重试</button></p>
 </div>
</template>
