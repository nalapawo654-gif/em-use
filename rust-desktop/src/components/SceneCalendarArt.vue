<script setup lang="ts">
import { computed,ref,watch } from 'vue'
import { PhCalendarBlank } from '@phosphor-icons/vue'
import { calendarArt } from '../shared/calendarArt'
import { CALENDAR_PROPS,type CalendarPropScene } from '../shared/calendarProps'
const props=defineProps<{scene:CalendarPropScene;time?:string;alert?:boolean;gentle?:boolean}>()
const spec=computed(()=>CALENDAR_PROPS[props.scene]),canvas=ref<HTMLCanvasElement>(),ready=ref(false),failed=ref(false)
watch(()=>spec.value.asset,async(path,_,onCleanup)=>{let cancelled=false;onCleanup(()=>cancelled=true);ready.value=false;failed.value=false;try{const art=await calendarArt(path);if(cancelled||!canvas.value)return;canvas.value.width=art.width;canvas.value.height=art.height;canvas.value.getContext('2d')!.drawImage(art,0,0);ready.value=true}catch{if(!cancelled)failed.value=true}},{immediate:true,flush:'post'})
</script>
<template><span class="scene-calendar-art" :class="{'scene-calendar-arrival':alert&&!gentle}" :data-ready="ready" :style="{'--calendar-ink':spec.ink,'--calendar-art-size':`${Math.min(spec.width,spec.height)}cqw`}"><canvas ref="canvas" aria-hidden="true"/><span v-if="ready" class="scene-calendar-paper" aria-hidden="true"><PhCalendarBlank weight="duotone"/><b>{{time||'今日'}}</b></span><PhCalendarBlank v-if="failed" class="calendar-art-fallback"/></span></template>
