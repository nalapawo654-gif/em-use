<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { LuckyCatSkin } from '../shared/types'
import { luckycatFrame, luckycatLevel, type LuckyCatAction } from '../luckycat/play'
import { loadCatRig, type CatRig } from '../luckycat/sprites'
import { CAT_DURATIONS, catMotionDelay, catMotionPool, chooseCatMotion, type CatMotion } from '../luckycat/motion'
import { drawCat } from '../luckycat/renderer'
const props=withDefaults(defineProps<{percent?:number|null;action?:LuckyCatAction;skin?:LuckyCatSkin;gentle?:boolean;paused?:boolean;ambient?:boolean;ambientAllowed?:boolean;restart?:number;sample?:{motion:LuckyCatAction;progress:number}}>(),{percent:null,action:'idle',skin:'classic',gentle:false,paused:false,ambient:false,ambientAllowed:true})
const emit=defineEmits<{motion:[CatMotion|null]}>()
const canvas=ref<HTMLCanvasElement>(),ready=ref(false),error=ref(false),current=ref<CatMotion|null>(null),visible=ref(!document.hidden)
const media=matchMedia('(prefers-reduced-motion: reduce)'),systemGentle=ref(media.matches)
const gentle=computed(()=>props.gentle||systemGentle.value)
const enabled=computed(()=>ready.value&&!props.paused&&visible.value&&!gentle.value)
let rig:CatRig|undefined,disposed=false,version=0,raf=0,timer:ReturnType<typeof setTimeout>|undefined,start=0,previous:CatMotion|null=null,lastDraw=-Infinity
const liveMotion=computed(()=>props.action!=='idle'?props.action:current.value)
function draw(motion:LuckyCatAction='idle',progress=0,time=0){const ctx=canvas.value?.getContext('2d');if(ctx&&rig)drawCat(ctx,rig,props.percent,motion,progress,{puppet:props.ambient&&luckycatLevel(props.percent)==='full',time})}
function halt(){clearTimeout(timer);timer=undefined;cancelAnimationFrame(raf);raf=0;current.value=null;emit('motion',null)}
function idle(){draw();if(enabled.value&&props.ambient&&props.ambientAllowed&&props.action==='idle')schedule()}
function tick(now:number){
 if(disposed||!enabled.value)return
 const motion=liveMotion.value
 if(!motion){idle();return}
 const p=Math.min(1,(now-start)/CAT_DURATIONS[motion])
 if(now-lastDraw>=1000/30){draw(motion,props.action==='box'?Math.min(.55,p):p,now);lastDraw=now}
 if(p>=1&&props.action==='idle'){current.value=null;emit('motion',null);idle();return}
 if(p<1)raf=requestAnimationFrame(tick)
}
function schedule(first=false){
 if(timer||!enabled.value||!props.ambient||!props.ambientAllowed||props.action!=='idle'||props.sample)return
 timer=setTimeout(()=>{
  timer=undefined;if(!enabled.value||!props.ambientAllowed||props.action!=='idle'||disposed)return
  const firstMotion=first?'blink':null
  const chosen=firstMotion&&catMotionPool(luckycatLevel(props.percent)).includes(firstMotion)?firstMotion:chooseCatMotion(props.percent,previous)
  current.value=chosen;previous=chosen;emit('motion',chosen);start=performance.now();raf=requestAnimationFrame(tick)
 },catMotionDelay(Math.random,first))
}
function resume(){
 halt();if(!rig)return
 if(props.sample){draw(props.sample.motion,props.sample.progress);return}
 if(!enabled.value){draw(props.action,props.action==='idle'?0:.55);return}
 if(props.action!=='idle'){start=performance.now();raf=requestAnimationFrame(tick)}
 else{draw();schedule(true)}
}
async function prepare(){const id=++version;halt();ready.value=false;error.value=false;rig=undefined
 try{const result=await loadCatRig(props.skin);if(disposed||id!==version)return;rig=result;ready.value=true;resume()}
 catch{if(!disposed&&id===version)error.value=true}
}
function mediaChanged(){systemGentle.value=media.matches}
function visibilityChanged(){visible.value=!document.hidden}
watch(()=>props.skin,prepare)
watch(()=>[enabled.value,props.action,props.restart],resume)
watch(()=>[props.ambientAllowed,props.percent],()=>{if(props.action==='idle')resume()})
watch(()=>props.sample,resume,{deep:true})
onMounted(()=>{media.addEventListener('change',mediaChanged);document.addEventListener('visibilitychange',visibilityChanged);void prepare()})
onUnmounted(()=>{disposed=true;++version;halt();media.removeEventListener('change',mediaChanged);document.removeEventListener('visibilitychange',visibilityChanged)})
</script>
<template><div class="luckycat-visual luckycat-articulated" :class="{gentle,paused}" :data-loaded="ready" :data-frame="luckycatFrame(percent,action)" :data-motion="sample?.motion ?? liveMotion ?? 'idle'" :data-skin="skin" aria-hidden="true"><canvas ref="canvas" width="512" height="512"></canvas><span v-if="!ready" class="luckycat-load">{{error?'猫猫服装素材未能加载，请切换场景重试。':'猫猫正在穿好衣服…'}}</span></div></template>
