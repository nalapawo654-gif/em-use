<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { hamsterProps } from '../hamster/sprites'
const props=defineProps<{index:number}>(), canvas=ref<HTMLCanvasElement>(), failed=ref(false)
let frames:HTMLCanvasElement[]|undefined
function draw(){const frame=frames?.[props.index], c=canvas.value;if(!frame||!c)return;c.width=frame.width;c.height=frame.height;c.getContext('2d')!.drawImage(frame,0,0)}
onMounted(async()=>{try{frames=await hamsterProps();draw()}catch{failed.value=true}});watch(()=>props.index,draw)
</script>
<template><span v-if="failed" class="hamster-prop-error" role="status">道具暂不可用</span><canvas v-else ref="canvas" class="hamster-prop" aria-hidden="true"/></template>
