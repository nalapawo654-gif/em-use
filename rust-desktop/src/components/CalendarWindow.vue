<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { api, appState as state } from '../bridge'
import CalendarCard from './CalendarCard.vue'
const props=defineProps<{toast?:boolean}>()
const hover=ref(false),host=ref<HTMLElement>()
let remaining=10000,last=Date.now()
watch(()=>state.calendar?.active.join(','),()=>{remaining=10000;last=Date.now()})
const timer=setInterval(()=>{const time=Date.now(),delta=Math.min(500,time-last);last=time;if(props.toast&&!hover.value&&!host.value?.querySelector(':focus-visible')){remaining-=delta;if(remaining<=0){remaining=Infinity;void api.hide()}}},100)
onUnmounted(()=>clearInterval(timer))
</script>
<template><div ref="host" class="calendar-window" @mouseenter="hover=true" @mouseleave="hover=false"><CalendarCard v-if="!toast||state.calendar?.active.length" :toast="toast" closeable @close="api.hide()"/></div></template>
