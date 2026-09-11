<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { batteryIdle, type BatteryPlay } from '../battery/play'
import { loadBatteryAtlas, type BatteryAtlas } from '../battery/sprites'
import { renderBattery } from '../battery/render'
import type { BatterySkin, BatteryRealm } from '../shared/types'
const props = withDefaults(defineProps<{ percent: number | null; skin?: BatterySkin; realm?: BatteryRealm; play?: BatteryPlay; reducedMotion?: boolean; night?: boolean; scenery?: boolean; active?: boolean }>(), { skin: 'classic', realm: 'office', play: () => batteryIdle(), active: true })
const canvas = ref<HTMLCanvasElement>(), loaded = ref(false), failed = ref(false)
let atlas: BatteryAtlas | undefined, raf = 0, disposed = false, last = 0
const animated = () => !props.reducedMotion && props.active && !document.hidden
function draw(time: number) {
  const ctx = canvas.value?.getContext('2d')
  if (ctx && atlas) { ctx.setTransform(1.5, 0, 0, 1.5, 0, 0); canvas.value!.dataset.exercise = renderBattery(ctx, atlas, { percent: props.percent, skin: props.skin, realm: props.realm, play: props.play, time, gentle: !animated(), night: props.night, scenery: props.scenery }) }
}
function tick(time: number) { if (disposed) return; if (time - last >= 32) { draw(time); last = time } if (animated()) raf = requestAnimationFrame(tick) }
function update() { cancelAnimationFrame(raf); draw(performance.now()); if (atlas && animated()) raf = requestAnimationFrame(tick) }
onMounted(async () => { document.addEventListener('visibilitychange', update); try { const result = await loadBatteryAtlas(); if (!disposed) { atlas = result; loaded.value = true; update() } } catch { if (!disposed) failed.value = true } })
watch(() => [props.percent, props.skin, props.realm, props.play, props.reducedMotion, props.night, props.active, props.scenery], update)
onUnmounted(() => { disposed = true; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', update) })
</script>
<template><div class="battery-visual" :data-loaded="loaded"><canvas ref="canvas" width="768" height="768" aria-hidden="true"></canvas><p v-if="failed" role="alert">电池人素材加载失败，请重新打开场景。</p><p v-else-if="!loaded" role="status">电池人热身中…</p></div></template>
