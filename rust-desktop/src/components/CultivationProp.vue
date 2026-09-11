<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ index: number }>()
const failed = ref(false)
</script>
<template><span class="cultivation-prop"><img v-if="!failed" :src="'./assets/cultivation/props.png'" alt="" draggable="false" :style="{ transform: `translate(${-100 / 3 * (index % 3)}%, ${-100 / 3 * Math.floor(index / 3)}%)` }" @error="failed = true"/><span v-else class="cultivation-asset-error">素材未加载</span></span></template>
