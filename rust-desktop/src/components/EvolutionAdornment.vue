<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { evolution, evolutionGlow, evolutionMotion, evolutionHidden } from '../evolution/controller'
import { gearPlacement, loadEvolutionParts, type GearScene, type GearPart } from '../evolution/art'
const props = withDefaults(defineProps<{ scene: GearScene; layer: 'back' | 'front'; pose?: number; form?: string; paused?: boolean }>(), { pose: 0, form: 'chibi' })
const images = ref<string[]>([]), failed = ref(false)
let generation = 0
const shown = computed(() => evolution.awake || evolution.phase === 'return')
const indices = computed<GearPart[]>(() => props.layer === 'back' ? [0] : props.scene === 'fox' && props.pose >= 3 ? [] : ['potato','buddy','feidudu'].includes(props.scene) ? [1,2] : [1,2,3])
async function load() { if (images.value.length) return; const id = ++generation; try { const result = await loadEvolutionParts(props.scene); if (id === generation) { images.value = result; failed.value = false } } catch { if (id === generation) failed.value = true } }
watch(shown, load, { immediate: true }); watch(() => props.scene, () => { generation++; images.value = []; void load() })
onUnmounted(() => { generation++ })
function style(part: GearPart) { const [x,y,w,h,angle=0] = gearPlacement(props.scene,part,props.pose,props.form); return { left: `${x*100}%`, top: `${y*100}%`, width: `${w*100}%`, height: `${h*100}%`, '--angle': `${angle}deg`, '--part': part } }
</script>
<template>
  <span v-if="shown" class="evolution-adornment" :class="[layer, 'phase-'+evolution.phase, 'motion-'+evolutionMotion, { paused: paused || evolutionHidden }]" :data-evolution-art="scene" :data-art-ready="images.length === 4" :data-art-error="failed" :style="{ '--evolution-glow': evolutionGlow }" aria-hidden="true">
    <img v-for="part in indices" v-show="images[part]" :key="part" :src="images[part]" :style="style(part)" :data-part="part" alt="" draggable="false"/>
  </span>
</template>
<style>
.evolution-equipped{isolation:isolate}
.evolution-equipped>canvas,.evolution-equipped>.evolution-base,.evolution-equipped>.skadi-figure{position:relative;z-index:1}
.cultivator-motion.evolution-equipped{position:relative}
.fox-motion.evolution-equipped>.fox-body,.fox-motion.evolution-equipped>.fox-whole,.fox-motion.evolution-equipped>.fox-tail{z-index:1}
.evolution-adornment{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;pointer-events:none!important;overflow:visible;isolation:isolate}
.evolution-adornment.back{z-index:0}.evolution-adornment.front{z-index:2}
.evolution-adornment img{position:absolute!important;object-fit:contain!important;max-width:none!important;max-height:none!important;transform:translate(-50%,-50%) rotate(var(--angle));transform-origin:center;user-select:none;filter:drop-shadow(0 0 calc(2px * var(--evolution-glow)) #dfb65c60);transition:top .2s,height .2s,opacity .2s}
.evolution-adornment.phase-unfold img{animation:evolution-unfold .5s cubic-bezier(.2,.7,.3,1) both;animation-delay:calc(var(--part)*20ms)}
.evolution-adornment.phase-reveal img{animation:evolution-reveal .5s ease-out both}
.evolution-adornment.phase-return{animation:evolution-return .6s ease-in both}
.evolution-adornment.motion-light{animation:evolution-fade .2s ease-out both}
.evolution-adornment.motion-light img,.evolution-adornment.motion-off img{animation:none!important;transition:none!important}
.evolution-adornment.motion-off{animation:none!important}.evolution-adornment.paused *{animation-play-state:paused!important}
@keyframes evolution-unfold{from{opacity:0;transform:translate(-50%,-45%) rotate(var(--angle)) scale(.55)}to{opacity:1;transform:translate(-50%,-50%) rotate(var(--angle)) scale(1)}}
@keyframes evolution-reveal{0%{filter:drop-shadow(0 0 7px #ffe5a0)}100%{filter:drop-shadow(0 0 1px #dfb65c40)}}
@keyframes evolution-return{to{opacity:0;scale:.94}}
@keyframes evolution-fade{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.evolution-adornment,.evolution-adornment img{animation:none!important;transition:none!important}}
</style>
