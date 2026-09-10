<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { beaverRig, type BeaverRig } from '../beaver/sprites'
import { sampleBeaverMotion } from '../beaver/motion'
import { renderBeaver } from '../beaver/render'
import type { BeaverAction } from '../beaver/play'
import type { BeaverSkin } from '../shared/types'
const props = defineProps<{ level: number; skin: BeaverSkin; action: BeaverAction; since: number; reducedMotion: boolean }>()
const canvas = ref<HTMLCanvasElement>(), failed = ref(false)
let rig: BeaverRig | undefined, loadedSkin: BeaverSkin = props.skin, revision=0, animation=0, last=0, disposed=false
async function load() {
  const ticket=++revision
  const skin=props.skin
  try { const images=await beaverRig(skin); if(!disposed&&ticket===revision) { rig=images;loadedSkin=skin;failed.value=false } }
  catch { if(!disposed&&ticket===revision) failed.value=true }
}
function draw(now: number) {
  if(disposed) return
  animation=requestAnimationFrame(draw)
  if(!canvas.value||!rig||document.hidden||now-last<(props.reducedMotion?160:33)) return
  last=now
  const motion=sampleBeaverMotion(props.action,Math.max(0,now-props.since),now,props.level,props.reducedMotion)
  renderBeaver(canvas.value.getContext('2d')!,rig,loadedSkin,props.action,now,motion)
}
onMounted(()=>{void load();animation=requestAnimationFrame(draw)})
watch(()=>props.skin,load)
onUnmounted(()=>{disposed=true;revision++;cancelAnimationFrame(animation)})
</script>
<template><canvas ref="canvas" width="640" height="512" aria-hidden="true"/><span v-if="failed" role="alert" class="beaver-asset-error">海狸鼠素材未加载<button @click.stop="load">重试</button></span></template>
