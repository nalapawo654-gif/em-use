<script setup lang="ts">
import { evolution, evolutionMotion } from '../evolution/controller'
import { setEvolutionLoading, setEvolutionCinematic } from '../evolution/readiness'
import { loadDinosaurTransformation, createDinosaurTransformationRenderer } from '../dinosaur/transformation'
import { useAwakenedArt } from '../evolution/useAwakenedArt'
import { energyFrame } from '../evolution/atlas'
import { useAwakeningProps, paintInteraction } from '../evolution/interactionArt'
import { vEvolutionMaterial } from '../evolution/material'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { dinosaurFrame, type DinosaurAction } from '../dinosaur/play'
import { loadDinosaur } from '../dinosaur/sprites'
import { tintDinosaurPixels } from '../dinosaur/skins'
import { DINOSAUR_MOTIONS, type DinosaurMotion } from '../dinosaur/ambient'
import { loadDinosaurParts, createDinosaurMotionRenderer, type DinosaurParts } from '../dinosaur/motionRenderer'
import { useCharacterMail } from '../shared/characterMail'
import { renderDinosaurMail } from '../dinosaur/mail'
import type { DinosaurSkin } from '../shared/types'
const props = withDefaults(defineProps<{ message?: boolean; transformation?: boolean; percent?: number | null; action?: DinosaurAction; skin?: DinosaurSkin; gentle?: boolean; paused?: boolean; frame?: number; startedAt?: number }>(), { percent: null, action: 'idle', skin: 'classic', startedAt: 0 })
const { art: awakened, prepared: preparedAwakening } = useAwakenedArt('dinosaur',()=>props.skin)
const interactionArt=useAwakeningProps()
const mail=useCharacterMail()
const carrying=computed(()=>props.message&&mail?.active.value)
const canvas = ref<HTMLCanvasElement>(), loaded = ref(false), failed = ref(false), motionFailed = ref(false), rigLoaded = ref(false)
const index = computed(() => props.frame ?? dinosaurFrame(props.percent, props.action))
const motion = computed(() => props.action in DINOSAUR_MOTIONS ? props.action as DinosaurMotion : null)
const media = window.matchMedia('(prefers-reduced-motion: reduce)'), systemGentle = ref(media.matches), hidden = ref(document.hidden)
let frames: HTMLCanvasElement[] = [], disposed = false, parts: DinosaurParts | undefined, renderer: ReturnType<typeof createDinosaurMotionRenderer> | undefined
let source: HTMLCanvasElement | undefined, raf = 0
const originalOwner=Symbol('dinosaur-original'), ceremonyOwner=Symbol('dinosaur-cinematic'), ceremonyFrames=shallowRef<HTMLCanvasElement[]>(), ceremonyFailed=ref(false)
let ceremonyRevision=0, ceremonyRun=-1, ceremonyOriginal:HTMLCanvasElement|undefined
let ceremonyRenderer:ReturnType<typeof createDinosaurTransformationRenderer>|undefined
const cinematic=computed(()=>!!props.transformation && !!ceremonyFrames.value && !!preparedAwakening.value && loaded.value && evolution.phase!=='idle' && evolutionMotion.value==='full' && !hidden.value && (evolution.source==='codex'||evolution.kind==='source'))
async function loadCeremony(){
  if(!props.transformation)return
  const ticket=++ceremonyRevision;ceremonyFrames.value=undefined;ceremonyFailed.value=false;setEvolutionLoading(ceremonyOwner,true)
  try{const value=await loadDinosaurTransformation(props.skin);if(!disposed&&ticket===ceremonyRevision){ceremonyFrames.value=value;ceremonyRenderer=createDinosaurTransformationRenderer(value,props.skin)}}
  catch{if(!disposed&&ticket===ceremonyRevision)ceremonyFailed.value=true}
  finally{if(!disposed&&ticket===ceremonyRevision)setEvolutionLoading(ceremonyOwner,false)}
}
watch(cinematic,active=>setEvolutionCinematic(ceremonyOwner,active),{flush:'sync'})
watch(()=>props.skin,loadCeremony)
const gentle = computed(() => props.gentle || systemGentle.value)
function drawIdle() {
  const ctx=canvas.value?.getContext('2d')
  if(ctx&&source){ctx.clearRect(0,0,512,512);ctx.drawImage(source,0,0);if(carrying.value){
    if(!awakened.value&&index.value===0&&parts){renderer??=createDinosaurMotionRenderer(parts,props.skin);renderer(ctx,'phone',.5,mail!.paint)}
    else if(awakened.value)mail!.paint(ctx,{x:340,y:375,width:70,height:115},'propped');else renderDinosaurMail(ctx,source,index.value,mail!.paint)
  }if(awakened.value)paintInteraction(ctx,interactionArt.value,props.action)}
}
function prepare() {
  if(awakened.value){const pose=props.action==='rest'?4:props.action==='pillow'?2:props.action==='idle'?energyFrame(props.percent,5):props.action==='tea'?1:0;source=awakened.value.frames[pose];return}
  const original=frames[index.value]; if(!original)return
  source=document.createElement('canvas');source.width=source.height=512
  const ctx=source.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(original,0,0)
  if(props.skin!=='classic'){const pixels=ctx.getImageData(0,0,512,512);tintDinosaurPixels(pixels.data,props.skin);ctx.putImageData(pixels,0,0)}
}
function stop() { cancelAnimationFrame(raf); raf=0 }
function originalPose(){
  const original=frames[index.value];if(!original)return
  const copy=document.createElement('canvas');copy.width=copy.height=512
  const ctx=copy.getContext('2d')!;ctx.drawImage(original,0,0)
  if(props.skin!=='classic'){const p=ctx.getImageData(0,0,512,512);tintDinosaurPixels(p.data,props.skin);ctx.putImageData(p,0,0)}
  return copy
}
function renderCeremony(){
  const ctx=canvas.value?.getContext('2d'),target=preparedAwakening.value?.frames[energyFrame(props.percent,5)]
  if(!ctx||!target||!ceremonyRenderer)return false
  const reverse=evolution.kind==='source'&&evolution.source!=='codex'
  if(ceremonyRun!==evolution.started){
    ceremonyRun=evolution.started;ceremonyOriginal=originalPose()
    // Preserve the actual displayed starting pose when switching sources.
    if(!reverse&&evolution.kind==='source'&&canvas.value){
      const snapshot=document.createElement('canvas');snapshot.width=snapshot.height=512;snapshot.getContext('2d')!.drawImage(canvas.value,0,0);ceremonyOriginal=snapshot
    }
  }
  if(!ceremonyOriginal)return false
  const paint=(now:number)=>{
    if(disposed||!cinematic.value||!ceremonyRenderer)return
    const time=ceremonyRenderer(ctx,now-evolution.started,evolution.duration,ceremonyOriginal!,target,reverse)
    canvas.value!.dataset.transformationBeat=time.beat
    canvas.value!.dataset.transformationProgress=time.progress.toFixed(3)
    if(!time.done)raf=requestAnimationFrame(paint)
  }
  paint(performance.now());return true
}
function render() {
  stop()
  if(cinematic.value&&renderCeremony())return
  if(canvas.value){delete canvas.value.dataset.transformationBeat;delete canvas.value.dataset.transformationProgress}
  prepare();renderer=parts?createDinosaurMotionRenderer(parts,props.skin,awakened.value?.frames[0]):undefined
  if(!motion.value||!parts){drawIdle();return}
  const ctx=canvas.value?.getContext('2d');if(!ctx)return
  const current=motion.value, duration=DINOSAUR_MOTIONS[current].duration
  if(gentle.value){renderer!(ctx,current,current==='fly'?.08:.5,carrying.value?mail!.paint:undefined);return}
  if(props.paused||hidden.value){drawIdle();return}
  const start=props.startedAt||performance.now();let last=-Infinity
  function tick(now:number){
    if(disposed||!renderer)return
    const progress=Math.max(0,Math.min(1,(now-start)/duration))
    if(now-last>=1000/30){renderer(ctx!,current,progress,carrying.value?mail!.paint:undefined);last=now}
    if(progress<1)raf=requestAnimationFrame(tick);else raf=0
  }
  raf=requestAnimationFrame(tick)
}
function systemMotionChanged() { systemGentle.value = media.matches }
function visibility() { hidden.value = document.hidden }
onMounted(async () => {

  if(props.transformation)setEvolutionLoading(originalOwner,true)
  void loadCeremony()
  media.addEventListener('change', systemMotionChanged); document.addEventListener('visibilitychange', visibility)
  void loadDinosaurParts().then(value=>{if(!disposed){parts=value;rigLoaded.value=true;render()}}).catch(()=>{if(!disposed)motionFailed.value=true})
  try { const images = await loadDinosaur(); if (!disposed) { frames = images; loaded.value = true; render() } }
  catch { if (!disposed) failed.value = true }
  finally{setEvolutionLoading(originalOwner,false)}
})
watch(() => [cinematic.value, evolution.started, evolution.phase, preparedAwakening.value, awakened.value, interactionArt.value, index.value, props.skin, props.action, props.startedAt, gentle.value, props.paused, hidden.value,carrying.value], render)
onUnmounted(() => { disposed = true; ceremonyRevision++; setEvolutionLoading(originalOwner,false);setEvolutionLoading(ceremonyOwner,false);setEvolutionCinematic(ceremonyOwner,false);stop(); media.removeEventListener('change', systemMotionChanged); document.removeEventListener('visibilitychange', visibility) })
</script>
<template>
  <div class="evolution-equipped dinosaur-visual" :class="['skin-' + skin, 'action-' + action, { gentle, paused: paused || hidden, 'rig-active': motion && rigLoaded, 'is-transforming': cinematic }]" :data-motion="motion" :data-frame="index" :data-loaded="loaded" :data-rig-loaded="rigLoaded">
    <canvas :data-awakened="!!awakened" v-evolution-material="{ scene: 'dinosaur', skin, pose: action, percent, cinematic }" ref="canvas" class="dinosaur-sprite" width="512" height="512" aria-hidden="true"></canvas>
    <span v-if="ceremonyFailed" class="dinosaur-ceremony-error" role="status">变身动作未加载，暂用简化过渡<button @click.stop="loadCeremony">重试</button></span>
    <span v-if="!loaded && !failed" class="dinosaur-load" role="status">小恐龙正抱着奶茶赶来…</span>
    <span v-if="failed || (motion && motionFailed)" class="dinosaur-load" role="alert">小恐龙素材加载失败，请重新打开场景。</span>
  </div>
</template>

<style scoped>
.dinosaur-visual.is-transforming .dinosaur-sprite{animation:none!important;transform:none!important;filter:none!important}
.dinosaur-ceremony-error{position:absolute;bottom:0;left:5%;right:5%;font-size:10px;text-align:center;color:#765939;background:#fff6e8;padding:4px;border-radius:5px;pointer-events:auto}
</style>
