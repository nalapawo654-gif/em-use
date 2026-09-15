<script setup lang="ts">
import { onMounted,ref } from 'vue'
import { PhCalendarBlank } from '@phosphor-icons/vue'
import { calendarArt } from '../shared/calendarArt'
defineProps<{time?:string;alert?:boolean;gentle?:boolean}>()
const canvas=ref<HTMLCanvasElement>(),ready=ref(false),failed=ref(false)
onMounted(async()=>{try{const art=await calendarArt('./assets/aquarium/calendar-clip.png');if(!canvas.value)return;canvas.value.width=art.width;canvas.value.height=art.height;canvas.value.getContext('2d')!.drawImage(art,0,0);ready.value=true}catch{failed.value=true}})
</script>
<template><span class="aquarium-calendar-art" :class="{'aquarium-calendar-arrival':alert&&!gentle}" :data-ready="ready"><canvas ref="canvas" aria-hidden="true"/><span v-if="ready" class="aquarium-calendar-paper" aria-hidden="true"><PhCalendarBlank weight="duotone"/><b>{{time||'今日'}}</b></span><PhCalendarBlank v-if="failed" class="calendar-art-fallback"/></span></template>
