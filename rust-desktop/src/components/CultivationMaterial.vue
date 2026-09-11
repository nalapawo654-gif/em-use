<script setup lang="ts">
import { computed, ref, watch } from 'vue'
const props=withDefaults(defineProps<{ index: number; atlas?: 'materials' | 'islands' }>(),{atlas:'materials'})
const failed=ref(false),columns=computed(()=>props.atlas==='islands'?2:4),rows=computed(()=>props.atlas==='islands'?2:3)
const source=computed(()=>`./assets/cultivation/${props.atlas}.png`)
watch(source,()=>failed.value=false)
</script>
<template><span class="cultivation-material" :data-material="index" :data-atlas="atlas"><img v-if="!failed" :src="source" alt="" draggable="false" :style="{width:`${columns*100}%`,height:`${rows*100}%`,transform:`translate(${-100/columns*(index%columns)}%, ${-100/rows*Math.floor(index/columns)}%)`}" @error="failed=true"/><span v-else class="cultivation-asset-error">物料未加载</span></span></template>
