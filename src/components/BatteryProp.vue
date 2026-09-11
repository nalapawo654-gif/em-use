<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { loadBatteryAtlas, type BatteryAtlas } from '../battery/sprites'
const props = defineProps<{ index: number }>()
const canvas = ref<HTMLCanvasElement>()
let atlas: BatteryAtlas | undefined, disposed = false
function draw() { const ctx = canvas.value?.getContext('2d'), im = atlas?.[props.index]; if (!ctx || !im) return; ctx.clearRect(0, 0, 160, 160); const k = Math.min(152 / im.width, 152 / im.height); ctx.drawImage(im, (160 - im.width * k) / 2, (160 - im.height * k) / 2, im.width * k, im.height * k) }
onMounted(async () => { try { const result = await loadBatteryAtlas(); if (!disposed) { atlas = result; draw() } } catch { /* The main character shows the shared asset error. */ } })
watch(() => props.index, draw); onUnmounted(() => { disposed = true })
</script>
<template><canvas ref="canvas" class="battery-prop" width="160" height="160" aria-hidden="true"></canvas></template>
