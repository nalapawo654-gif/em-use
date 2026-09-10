<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { HamsterAction, HamsterLevel } from '../hamster/play'
import { loadHamsterSkin, type HamsterRig } from '../hamster/sprites'
import { hamsterFrame, hamsterRunning, renderHamster } from '../hamster/render'
import type { HamsterSkin } from '../shared/types'
const props = withDefaults(defineProps<{ level: HamsterLevel; skin?: HamsterSkin; action?: HamsterAction; reducedMotion?: boolean; active?: boolean }>(), { action: 'idle', active: true, skin: 'classic' })
const canvas = ref<HTMLCanvasElement>(), failed = ref(false), loaded = ref(false)
const frame = computed(() => hamsterFrame(props.level, props.action))
let frames: HamsterRig | undefined, raf = 0, disposed = false, last = 0
const animated = () => !props.reducedMotion && props.active && !document.hidden && (['wheel','feed','pet','coffee','groom','bell','tease'].includes(props.action) || hamsterRunning(props.level,props.action))
function draw(time: number) { if (frames && canvas.value) { const ctx = canvas.value.getContext('2d'); if (ctx) canvas.value.dataset.runFrame=String(renderHamster(ctx, frames, props.level, props.action, time, animated(), props.skin)) } }
function tick(time: number) { if (disposed) return; if (time - last >= 32) { draw(time); last = time } if (animated()) raf = requestAnimationFrame(tick) }
function update() { cancelAnimationFrame(raf); draw(performance.now()); if (animated() && frames) raf = requestAnimationFrame(tick) }
let request=0
async function loadSkin(){const id=++request;failed.value=false;loaded.value=false;try{const next=await loadHamsterSkin(props.skin);if(!disposed&&id===request){frames=next;loaded.value=true;update()}}catch{if(!disposed&&id===request)failed.value=true}}
onMounted(()=>{document.addEventListener('visibilitychange',update);void loadSkin()})
watch(()=>props.skin,loadSkin)
watch(()=>[props.level,props.action,props.reducedMotion,props.active],update)
onUnmounted(() => { disposed = true; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', update) })
</script>
<template><div class="hamster-visual" :class="['hamster-level-' + level, 'hamster-action-' + action]" :data-pose="frame" :data-loaded="loaded"><canvas ref="canvas" width="512" height="512" aria-hidden="true"></canvas><p v-if="failed" class="hamster-asset-error" role="alert">仓鼠素材加载失败，请重新打开场景。</p><p v-else-if="!loaded" class="hamster-asset-error" role="status">鼠鼠正在赶来…</p></div></template>
