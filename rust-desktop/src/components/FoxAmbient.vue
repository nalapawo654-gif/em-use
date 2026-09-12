<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { FoxLevel } from '../fox/play'
import type { FoxSkin } from '../shared/types'
import { loadFox, loadFoxGroomRig } from '../fox/sprites'
import { foxCanvas, createFoxMotionRenderer } from '../fox/motionRenderer'
import { FOX_MOTIONS, chooseFoxMotion, foxEnvelope, foxMotionDelay, foxMotionPool, type FoxMotion } from '../fox/ambient'
const props = defineProps<{ level: FoxLevel; skin: FoxSkin; allowed: boolean; gentle: boolean; paused: boolean; sample?: { motion: FoxMotion; progress: number } }>()
const emit = defineEmits<{ motion: [FoxMotion | null]; tail: [number] }>()
const canvas = ref<HTMLCanvasElement>(), ready = ref(false), failed = ref(false), current = ref<FoxMotion | null>(null)
const media = matchMedia('(prefers-reduced-motion: reduce)'), systemGentle = ref(media.matches), visible = ref(!document.hidden)
const enabled = computed(() => ready.value && props.allowed && !props.gentle && !props.paused && !systemGentle.value && visible.value && !props.sample)
let disposed = false, version = 0, renderer: ReturnType<typeof createFoxMotionRenderer> | undefined, timer: ReturnType<typeof setTimeout> | undefined, raf = 0, previous: FoxMotion | null = null
function draw(motion: FoxMotion | null = null, progress = 0) {
  const ctx = canvas.value?.getContext('2d');if(ctx && renderer) renderer(ctx,motion,progress)
  emit('tail',motion==='tail'?Math.sin(progress*Math.PI)*foxEnvelope(progress)*6:0)
}
function stop() { clearTimeout(timer);timer=undefined;cancelAnimationFrame(raf);raf=0;current.value=null;emit('motion',null);draw() }
function schedule(first = false) {
  if(!enabled.value || disposed)return
  timer=setTimeout(()=>{
    if(!enabled.value || disposed)return
    const chosen = first && previous === null ? (foxMotionPool(props.level).includes('groom') ? 'groom' : foxMotionPool(props.level)[0]!) : chooseFoxMotion(props.level,previous)
    previous=chosen;current.value=chosen;emit('motion',chosen)
    const start=performance.now(),duration=FOX_MOTIONS[chosen].duration;let last=-Infinity
    function tick(now: number){
      if(!enabled.value || disposed){stop();return}
      const progress=(now-start)/duration
      if(progress>=1){current.value=null;emit('motion',null);raf=0;draw();schedule();return}
      if(now-last>=1000/30){draw(chosen,progress);last=now}
      raf=requestAnimationFrame(tick)
    }
    raf=requestAnimationFrame(tick)
  },foxMotionDelay(Math.random,first))
}
function sample() { if(props.sample && renderer){stop();current.value=props.sample.motion;emit('motion',props.sample.motion);draw(props.sample.motion,props.sample.progress)} }
async function prepare() {
  const ticket=++version;stop();ready.value=false;failed.value=false;renderer=undefined
  try {
    const full=props.level==='full'||props.level==='unknown'
    const frames=full?await loadFoxGroomRig(props.skin):await loadFox(props.skin)
    const [source,arm]=await Promise.all([foxCanvas(frames[full?0:props.level==='medium'?3:props.level==='low'?4:5]),full?foxCanvas(frames[2],true):Promise.resolve(undefined)])
    if(disposed || ticket!==version)return
    renderer=createFoxMotionRenderer(source,props.level,arm);ready.value=true;draw();sample()
  } catch { if(!disposed && ticket===version)failed.value=true }
}
function resume(){stop();if(props.sample)sample();else schedule(true)}
function mediaChanged(){systemGentle.value=media.matches}
function visibilityChanged(){visible.value=!document.hidden}
onMounted(()=>{media.addEventListener('change',mediaChanged);document.addEventListener('visibilitychange',visibilityChanged);void prepare()})
watch(()=>[props.level,props.skin],()=>void prepare())
watch(enabled,resume)
watch(()=>props.sample,sample,{deep:true})
onUnmounted(()=>{disposed=true;++version;stop();media.removeEventListener('change',mediaChanged);document.removeEventListener('visibilitychange',visibilityChanged)})
</script>
<template><div class="fox-ambient" :data-motion="current" :data-loaded="ready"><canvas ref="canvas" width="512" height="512"></canvas><span v-if="failed" class="fox-load">小狐狸动作素材未能加载，请切换场景重试。</span></div></template>
