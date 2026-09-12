<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { dinosaurFrame, type DinosaurAction } from '../dinosaur/play'
import { loadDinosaur } from '../dinosaur/sprites'
import { tintDinosaurPixels } from '../dinosaur/skins'
import { DINOSAUR_MOTIONS, type DinosaurMotion } from '../dinosaur/ambient'
import { loadDinosaurParts, createDinosaurMotionRenderer, type DinosaurParts } from '../dinosaur/motionRenderer'
import type { DinosaurSkin } from '../shared/types'
const props = withDefaults(defineProps<{ percent?: number | null; action?: DinosaurAction; skin?: DinosaurSkin; gentle?: boolean; paused?: boolean; frame?: number; startedAt?: number }>(), { percent: null, action: 'idle', skin: 'classic', startedAt: 0 })
const canvas = ref<HTMLCanvasElement>(), loaded = ref(false), failed = ref(false), motionFailed = ref(false), rigLoaded = ref(false)
const index = computed(() => props.frame ?? dinosaurFrame(props.percent, props.action))
const motion = computed(() => props.action in DINOSAUR_MOTIONS ? props.action as DinosaurMotion : null)
const media = window.matchMedia('(prefers-reduced-motion: reduce)'), systemGentle = ref(media.matches), hidden = ref(document.hidden)
let frames: HTMLCanvasElement[] = [], disposed = false, parts: DinosaurParts | undefined, renderer: ReturnType<typeof createDinosaurMotionRenderer> | undefined
let source: HTMLCanvasElement | undefined, raf = 0
const gentle = computed(() => props.gentle || systemGentle.value)
function drawIdle() {
  const ctx=canvas.value?.getContext('2d')
  if(ctx&&source){ctx.clearRect(0,0,512,512);ctx.drawImage(source,0,0)}
}
function prepare() {
  const original=frames[index.value]; if(!original)return
  source=document.createElement('canvas');source.width=source.height=512
  const ctx=source.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(original,0,0)
  if(props.skin!=='classic'){const pixels=ctx.getImageData(0,0,512,512);tintDinosaurPixels(pixels.data,props.skin);ctx.putImageData(pixels,0,0)}
}
function stop() { cancelAnimationFrame(raf); raf=0 }
function render() {
  stop();prepare()
  if(!motion.value||!parts){drawIdle();return}
  renderer=createDinosaurMotionRenderer(parts,props.skin)
  const ctx=canvas.value?.getContext('2d');if(!ctx)return
  const current=motion.value, duration=DINOSAUR_MOTIONS[current].duration
  if(gentle.value){renderer(ctx,current,current==='fly'?.08:.5);return}
  if(props.paused||hidden.value){drawIdle();return}
  const start=props.startedAt||performance.now();let last=-Infinity
  function tick(now:number){
    if(disposed||!renderer)return
    const progress=Math.max(0,Math.min(1,(now-start)/duration))
    if(now-last>=1000/30){renderer(ctx!,current,progress);last=now}
    if(progress<1)raf=requestAnimationFrame(tick);else raf=0
  }
  raf=requestAnimationFrame(tick)
}
function systemMotionChanged() { systemGentle.value = media.matches }
function visibility() { hidden.value = document.hidden }
onMounted(async () => {
  media.addEventListener('change', systemMotionChanged); document.addEventListener('visibilitychange', visibility)
  void loadDinosaurParts().then(value=>{if(!disposed){parts=value;rigLoaded.value=true;render()}}).catch(()=>{if(!disposed)motionFailed.value=true})
  try { const images = await loadDinosaur(); if (!disposed) { frames = images; loaded.value = true; render() } }
  catch { if (!disposed) failed.value = true }
})
watch(() => [index.value, props.skin, props.action, props.startedAt, gentle.value, props.paused, hidden.value], render)
onUnmounted(() => { disposed = true; stop(); media.removeEventListener('change', systemMotionChanged); document.removeEventListener('visibilitychange', visibility) })
</script>
<template>
  <div class="dinosaur-visual" :class="['skin-' + skin, 'action-' + action, { gentle, paused: paused || hidden, 'rig-active': motion && rigLoaded }]" :data-motion="motion" :data-frame="index" :data-loaded="loaded" :data-rig-loaded="rigLoaded">
    <canvas ref="canvas" class="dinosaur-sprite" width="512" height="512" aria-hidden="true"></canvas>
    <span v-if="!loaded && !failed" class="dinosaur-load" role="status">小恐龙正抱着奶茶赶来…</span>
    <span v-if="failed || (motion && motionFailed)" class="dinosaur-load" role="alert">小恐龙素材加载失败，请重新打开场景。</span>
  </div>
</template>
