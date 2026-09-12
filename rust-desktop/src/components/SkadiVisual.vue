<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { SkadiForm, SkadiSkin, SkadiWeapon as WeaponId } from '../shared/types'
import { skadiFrame, type SkadiAction } from '../skadi/play'
import { skadiAmbientAt, skadiBlinkAt, skadiMotionFrame, skadiWeaponPower } from '../skadi/motion'
import { loadSkadi, loadSkadiProps } from '../skadi/sprites'
import SkadiEffects from './SkadiEffects.vue'
import SkadiFigure from './SkadiFigure.vue'
const props = withDefaults(defineProps<{ percent?: number | null; action?: SkadiAction; skin?: SkadiSkin; form?: SkadiForm; weapon?: WeaponId; showWeapon?: boolean; ambient?: boolean; gentle?: boolean; paused?: boolean; sampleFrame?: number; fishing?: 'waiting'|'bite'|'missed'|'caught' }>(), { percent: null, action: 'idle', skin: 'classic', form: 'chibi', weapon:'sword',showWeapon:true,ambient:false, gentle: false, paused: false, fishing:'waiting' })
const frames = ref<string[]>([]), propFrames=ref<string[]>([]), error = ref(false), clock=ref(0)
let disposed = false, version = 0, timer: ReturnType<typeof setInterval> | undefined
const ambientAction=computed(()=>props.ambient&&props.action==='idle'&&skadiFrame('idle',props.percent)===0&&!props.gentle&&!props.paused?skadiAmbientAt(clock.value):'idle')
const effectiveAction=computed(()=>props.action==='idle'?ambientAction.value:props.action)
const frame = computed(() => props.sampleFrame ?? (effectiveAction.value==='idle' ? (skadiFrame('idle',props.percent)===0&&skadiBlinkAt(clock.value)&&!props.gentle&&!props.paused?1:skadiFrame('idle',props.percent)) : skadiMotionFrame(effectiveAction.value)))
const needsProp=computed(()=>['drink','fish','feed','work'].includes(props.action))
async function load() { const current = ++version; error.value = false; frames.value = []; try { const result = await loadSkadi(props.skin,props.form); if (!disposed && current === version) frames.value = result } catch { if (!disposed && current === version) error.value = true } }
async function propsLoad(){if(!needsProp.value||propFrames.value.length)return;try{const result=await loadSkadiProps();if(!disposed)propFrames.value=result}catch{if(!disposed)error.value=true}}
watch(() => [props.skin,props.form], load)
watch(needsProp,propsLoad)
watch(()=>[props.action,props.gentle,props.paused],()=>{clock.value=0})
onMounted(() => { void load();void propsLoad();timer = setInterval(() => { if (!document.hidden&&!props.paused&&!props.gentle)clock.value+=100 },100) })
onUnmounted(() => { disposed = true; clearInterval(timer) })
</script>
<template>
<div class="skadi-visual" :class="[`skadi-action-${effectiveAction}`,`skadi-form-${form}`,{gentle,paused,'skadi-has-weapon':showWeapon}]" :data-loaded="!!frames.length" :data-frame="frame" :data-skin="skin" :data-form="form" :data-motion="effectiveAction" :data-weapon="weapon" :data-power="skadiWeaponPower(action)" :data-grip-mode="showWeapon?'held':'none'" aria-hidden="true">
  <div v-if="frames.length" class="skadi-motion"><img v-if="!showWeapon&&(gentle||paused)" :src="frames[frame]" alt="" draggable="false"/><SkadiFigure v-else :src="frames[frame]" :action="effectiveAction" :gentle="gentle" :paused="paused" :form="form" :skin="skin" :frame="frame" :weapon="weapon" :show-weapon="showWeapon"/></div>
  <span v-else class="skadi-load">{{error?'月汐的素材暂未加载，请切换场景重试。':'月汐正向你走来…'}}</span>
  <SkadiEffects :weapon="weapon" :action="effectiveAction" :gentle="gentle" :paused="paused"/>
  <div v-if="action==='pet'||action==='feed'" class="skadi-hearts"><span>♡</span><span>♡</span><span>♡</span></div>
  <div v-if="action==='sing'" class="skadi-notes"><span>♪</span><span>♫</span><span>♪</span></div>
  <span v-if="action==='sleep'" class="skadi-zzz">z <small>z</small></span>
  <template v-if="propFrames.length">
    <img v-if="action==='drink'" :src="propFrames[0]" class="skadi-prop skadi-teacup" alt=""/>
    <img v-if="action==='feed'" :src="propFrames[1]" class="skadi-prop skadi-snack" alt=""/>
    <img v-if="action==='work'" :src="propFrames[4]" class="skadi-prop skadi-laptop" alt=""/>
    <div v-if="action==='fish'" class="skadi-fishing" :class="fishing"><img :src="propFrames[2]" class="skadi-rod" alt=""/><i class="skadi-fishing-line"></i><i class="skadi-bobber"></i><img v-if="fishing==='caught'" :src="propFrames[3]" class="skadi-caught-fish" alt=""/></div>
  </template>
  <span v-if="error&&frames.length&&needsProp" class="skadi-prop-error">道具加载失败，请切换场景重试。</span>
</div>
</template>
