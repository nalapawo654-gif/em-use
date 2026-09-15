<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { PhCalendarBlank } from '@phosphor-icons/vue'
import { calendarArt } from '../shared/calendarArt'
defineProps<{ time?: string; alert?: boolean; gentle?: boolean }>()
const canvas=ref<HTMLCanvasElement>(),ready=ref(false),failed=ref(false)
onMounted(async()=>{
 try {
  const source=await calendarArt('./assets/buddy/calendar-stand.png')
  if(!canvas.value)return
  const c=canvas.value;c.width=source.width;c.height=source.height
  c.getContext('2d')!.drawImage(source,0,0);ready.value=true
 }catch{failed.value=true}
})
</script>
<template><span class="buddy-calendar-art" :class="{'calendar-arrival':alert&&!gentle}" :data-ready="ready"><canvas ref="canvas" aria-hidden="true"/><span v-if="ready" class="calendar-paper-copy" aria-hidden="true"><PhCalendarBlank weight="duotone"/><b>{{time||'今日'}}</b></span><PhCalendarBlank v-if="failed" class="calendar-art-fallback"/><span v-if="failed" class="calendar-art-error">日历图未加载</span></span></template>
