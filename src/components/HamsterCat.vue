<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { catFrames } from '../hamster/sprites'
import { catPose, renderCat, CAT_LABELS, type CatMood } from '../hamster/cat'
import type { HamsterAction } from '../hamster/play'
const props=withDefaults(defineProps<{action:HamsterAction;since:number;night:boolean;reducedMotion:boolean;active:boolean}>(),{active:true})
const canvas=ref<HTMLCanvasElement>(), mood=ref<CatMood>('watch'), frame=ref(0),failed=ref(false)
let frames:HTMLCanvasElement[]|undefined,raf=0,disposed=false,last=0,start=performance.now()
const animated=()=>props.active&&!props.reducedMotion&&!document.hidden
function draw(time:number){
  const pose=catPose(time-start,props.action,props.since,time,props.night,props.reducedMotion)
  mood.value=pose.mood;frame.value=pose.frame
  if(frames&&canvas.value){const ctx=canvas.value.getContext('2d');if(ctx)renderCat(ctx,frames,pose.frame,pose.mood,time,animated())}
}
function tick(time:number){if(disposed)return;if(time-last>=50){draw(time);last=time}if(animated())raf=requestAnimationFrame(tick)}
function update(){cancelAnimationFrame(raf);draw(performance.now());if(animated()&&frames)raf=requestAnimationFrame(tick)}
onMounted(async()=>{document.addEventListener('visibilitychange',update);try{frames=await catFrames();if(!disposed)update()}catch{if(!disposed)failed.value=true}})
watch(()=>props.action,(action,previous)=>{if(action==='idle'&&(previous.startsWith('cat-')||['feed','bell','tease','sleep'].includes(previous)))start=performance.now();update()})
watch(()=>[props.since,props.night,props.reducedMotion,props.active],update)
onUnmounted(()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',update)})
</script>
<template><div class="hamster-cat-visual" :data-mood="mood" :data-frame="frame"><canvas ref="canvas" width="384" height="341" aria-hidden="true"/><span class="hamster-cat-caption">{{ failed?'猫猫暂时没赶来':CAT_LABELS[mood] }}</span><em v-if="mood==='sleep'" class="hamster-cat-zzz" aria-hidden="true"><i>z</i><i>Z</i><i>z</i></em></div></template>
