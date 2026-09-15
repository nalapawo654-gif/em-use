<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from 'vue'
import { PhCalendarBlank, PhX, PhArrowClockwise, PhArrowSquareOut, PhMapPin, PhCheck, PhClock } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop } from '../bridge'
import { calendarTime, eventStatus, overlaps, reminderHeading, calendarPersona } from '../shared/calendar'
defineProps<{ toast?: boolean; closeable?: boolean }>()
const emit=defineEmits<{close:[]}>()
const now=ref(Date.now()),error=ref(''),busy=ref(''),feedback=ref(''),past=ref(false)
const timer=setInterval(()=>now.value=Date.now(),1000);onUnmounted(()=>clearInterval(timer))
const calendar=computed(()=>state.calendar)
const active=computed(()=>calendar.value?.items.filter(e=>calendar.value?.active.includes(e.key))??[])
const upcoming=computed(()=>calendar.value?.items.filter(e=>e.allDay||e.end>now.value)??[])
const history=computed(()=>calendar.value?.items.filter(e=>!e.allDay&&e.end<=now.value)??[])
watch(()=>calendar.value?.epoch,()=>{feedback.value='';error.value=''})
async function respond(key:string,choice:'ack'|'snooze'){
 if(busy.value||!calendar.value)return
 busy.value=key;error.value='';const epoch=calendar.value.epoch
 try{if(!api.respondCalendar)throw Error('请在桌面应用中使用日程提醒');await api.respondCalendar(epoch,key,choice);if(calendar.value?.epoch===epoch)feedback.value=choice==='ack'?'这次不再提醒，安排仍保留在日历里。':'已设置稍后提醒。'}catch(e){error.value=String(e instanceof Error?e.message:e)}finally{busy.value=''}
}
async function refresh(){error.value='';try{if(!api.refreshCalendar)throw Error('浏览器仅展示演示日程');await api.refreshCalendar()}catch(e){error.value=String(e instanceof Error?e.message:e)}}
async function open(){error.value='';try{if(!api.openCalendar)throw Error('请点击桌宠旁的日历查看安排');await api.openCalendar()}catch(e){error.value=String(e instanceof Error?e.message:e)}}
async function dongdong(){error.value='';try{if(!api.openDongdong)throw Error('请在桌面应用中打开咚咚');await api.openDongdong()}catch(e){error.value=String(e instanceof Error?e.message:e)}}
</script>
<template>
 <section class="calendar-card" :class="{'calendar-reminder':toast,'calendar-aquarium-card':state.settings.scene==='aquarium'}" role="dialog" :aria-label="toast?'会前日程提醒':'今日日程'" @keydown.esc.stop="emit('close')" data-pet-gesture @pointerdown.stop @click.stop @wheel.stop>
  <header><div class="calendar-card-heading"><PhCalendarBlank weight="duotone"/><span>{{toast?'日程提醒':'今日日程'}}<small>{{calendar?.date||'等待同步'}} · 北京时间<span v-if="!isDesktop"> · 演示</span></small></span></div><div class="calendar-header-actions"><button v-if="!toast" aria-label="刷新日程" :disabled="calendar?.status==='connecting'" @click="refresh"><PhArrowClockwise/></button><button v-if="closeable" :aria-label="toast?'收起日程提醒':'关闭日程'" @click="emit('close')"><PhX/></button></div></header>
  <p v-if="calendar?.status==='stale'" class="calendar-sync-note">按上次同步安排 · {{calendar.fetchedAt?calendarTime(calendar.fetchedAt):'尚未同步'}}<br/>{{calendar.message}}</p>
  <p v-else-if="calendar&&!['ready'].includes(calendar.status)" class="calendar-sync-note">{{calendar.message}}</p>
  <div v-if="toast&&active.length" class="calendar-reminder-body">
   <p v-if="active.length>1" class="calendar-conflict">有 {{active.length}} 项日程需要留意</p>
   <article v-for="event in active" :key="event.key"><h2><span>{{reminderHeading(event,now)}}</span> · {{event.title}}</h2><p class="calendar-event-time">{{calendarTime(event.start)}}–{{calendarTime(event.end)}}<span v-if="event.rooms.length"> · {{event.rooms.join(' / ')}}</span></p><p class="calendar-persona">{{calendarPersona(state.settings.scene,event.start<=now)}}</p><div class="calendar-reminder-actions"><button class="calendar-primary" @click="open">查看日程</button><button :disabled="!!busy" @click="respond(event.key,'ack')">知道了</button><button v-if="event.start>now" class="calendar-text-action" :disabled="!!busy" @click="respond(event.key,'snooze')">{{event.start-now>120000?'2 分钟后提醒':'开始时提醒'}}</button></div></article>
  </div>
  <template v-else-if="!toast">
   <div class="calendar-list"><article v-for="event in upcoming" :key="event.key" :class="{'calendar-current':!event.allDay&&event.start<=now}"><div class="calendar-row-time"><b>{{event.allDay?'全天':calendarTime(event.start)}}</b><small v-if="!event.allDay">{{calendarTime(event.end)}}</small></div><div class="calendar-row-detail"><span class="calendar-event-status">{{eventStatus(event,now)}}</span><h3>{{event.title}}</h3><p v-if="event.rooms.length"><PhMapPin/>{{event.rooms.join(' / ')}}</p><small v-if="overlaps(event,upcoming)" class="calendar-conflict">与另一项日程时间重叠</small><div v-if="!event.allDay" class="calendar-row-actions"><button :disabled="!!busy" @click="respond(event.key,'ack')"><PhCheck/>这次不再提醒</button><button v-if="event.start>now&&event.start-now<=state.settings.calendarLeadMinutes*60000" :disabled="!!busy" @click="respond(event.key,'snooze')"><PhClock/>稍后提醒</button></div></div></article></div>
   <div v-if="!upcoming.length" class="calendar-empty"><PhCalendarBlank weight="duotone"/><b>{{calendar?.status==='ready'?(history.length?'今天后面没有日程了':'今天暂无日程'):'日历在这里等你'}}</b><p>{{calendar?.status==='ready'?'按自己的节奏来。':calendar?.message||'登录本机咚咚后，同步今天的安排。'}}</p></div>
   <button v-if="history.length" class="calendar-history-toggle" @click="past=!past">{{past?'收起':'查看'}}已过时段 · {{history.length}} 项</button><div v-if="past" class="calendar-history"><p v-for="e in history" :key="e.key">{{calendarTime(e.start)}} · {{e.title}}</p></div>
   <footer><span>{{calendar?.fetchedAt?'同步于 '+calendarTime(calendar.fetchedAt):'尚未同步'}}<small>{{calendar?.account?.name||'本机咚咚'}} · 仅在本工具提醒</small></span><button @click="dongdong">打开咚咚<PhArrowSquareOut/></button></footer>
  </template>
  <p v-if="feedback&&!toast" class="calendar-feedback" role="status">{{feedback}}</p><p v-if="error" class="calendar-error" role="alert">{{error}}</p>
 </section>
</template>
