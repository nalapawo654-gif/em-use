<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { BuddySkin } from '../shared/types'
import type { BuddyAction } from '../buddy/play'
import { buddyRig, type BuddyRig } from '../buddy/sprites'
import { sampleBuddyMotion, type BuddyMotion } from '../buddy/motion'
import { renderBuddy } from '../buddy/render'
const props=defineProps<{skin:BuddySkin; level:number; action:BuddyAction; since:number; reducedMotion:boolean}>()
const canvas=ref<HTMLCanvasElement|null>(null), failed=ref(false)
let rig:BuddyRig|undefined, raf=0, revision=0, last=0, motion:BuddyMotion|undefined, currentLevel=0
const preference=window.matchMedia('(prefers-reduced-motion: reduce)')
function paint(clock:number) {
  if(!rig||!canvas.value)return
  const reduced=props.reducedMotion||preference.matches
  const target=sampleBuddyMotion(props.action,Math.max(0,clock-props.since),clock,props.level,reduced)
  const dt=Math.min(100,Math.max(1,clock-last)), blend=reduced?1:1-Math.exp(-dt/85)
  if(!motion)motion={...target}
  for(const key of Object.keys(target) as (keyof BuddyMotion)[]) {
    if(typeof target[key]==='number') (motion as unknown as Record<string,number>)[key] += ((target as unknown as Record<string,number>)[key]-(motion as unknown as Record<string,number>)[key])*blend
  }
  motion.phase=target.phase;motion.expression=target.expression
  currentLevel+=(props.level-currentLevel)*(reduced?1:1-Math.exp(-dt/220))
  canvas.value.dataset.expression=motion.expression;canvas.value.dataset.phase=motion.phase
  renderBuddy(canvas.value.getContext('2d')!,rig,props.skin,props.action,Math.max(0,clock-props.since),motion,currentLevel)
  last=clock
}
function tick(clock:number){raf=requestAnimationFrame(tick);if(!document.hidden&&clock-last>=32)paint(clock)}
function schedule(){cancelAnimationFrame(raf);paint(performance.now());if(!props.reducedMotion&&!preference.matches)raf=requestAnimationFrame(tick)}
async function load(){const ticket=++revision;failed.value=false;try{const next=await buddyRig(props.skin);if(ticket!==revision)return;rig=next;motion=undefined;currentLevel=props.level;schedule()}catch{if(ticket===revision)failed.value=true}}
onMounted(()=>{preference.addEventListener('change',schedule);void load()})
watch(()=>props.skin,load);watch(()=>[props.action,props.since,props.level,props.reducedMotion],schedule)
onUnmounted(()=>{revision++;cancelAnimationFrame(raf);preference.removeEventListener('change',schedule)})
</script>
<template><span class="buddy-sprite buddy-rig"><canvas ref="canvas" width="512" height="512" aria-hidden="true"/><span v-if="failed" class="buddy-asset-error" role="alert">角色加载失败<button @click.stop="load">重试</button></span></span></template>
