<script setup lang="ts">
import { transformationAssetFailed, retryTransformationArt } from '../evolution/useTransformationArt'
import { evolutionCinematicActive } from '../evolution/readiness'
import { awakeningAssetFailed, retryAwakeningArt } from '../evolution/useAwakenedArt'
import { onUnmounted, watch } from 'vue'
import { PhSparkle } from '@phosphor-icons/vue'
import { evolution, setEvolutionBlocked, evolutionMotion } from '../evolution/controller'
const props = defineProps<{ blocked?: boolean }>()
const owner = Symbol('evolution-blocker')
watch(() => props.blocked, value => { setEvolutionBlocked(owner, !!value) }, { immediate: true, flush: 'sync' })
onUnmounted(() => { setEvolutionBlocked(owner, false) })
</script>
<template>
  <span class="evolution-surface" :class="['phase-' + evolution.phase, 'motion-' + evolutionMotion]" :data-evolution="evolution.awake ? 'awake' : 'original'" :data-phase="evolution.phase" aria-hidden="true">
    <span v-if="evolution.phase !== 'idle' && evolutionMotion === 'full' && !evolutionCinematicActive" :key="evolution.started" class="evolution-ring"/>
    <PhSparkle v-for="n in 5" v-show="evolution.phase !== 'idle' && evolutionMotion === 'full' && !evolutionCinematicActive" :key="`${evolution.started}-${evolution.phase}-${n}`" weight="fill" :style="{ '--i': n, top: `${20 + n % 3 * 16}%` }"/>
  </span>
  <span v-if="evolution.awake && awakeningAssetFailed" class="awakening-load-error" role="status" @pointerdown.stop>新造型未加载，暂用原造型<button @click.stop="retryAwakeningArt">重试</button></span>
  <span v-if="transformationAssetFailed" class="awakening-load-error" role="status" @pointerdown.stop>变身分镜未加载，暂用简化动画<button @click.stop="retryTransformationArt">重试</button></span>
</template>
<style>
.awakening-load-error{position:absolute;bottom:15%;left:10%;right:10%;z-index:8;padding:5px;border-radius:6px;background:#fff6e4;color:#684725;font-size:10px;text-align:center}.awakening-load-error button{margin-left:5px;cursor:pointer}

.evolution-surface{position:absolute;inset:12%;z-index:4;pointer-events:none!important;overflow:hidden;color:#e8c271}
.evolution-ring{position:absolute;left:15%;top:22%;width:70%;aspect-ratio:1;border:2px solid #e8c27199;border-radius:50%;box-shadow:0 0 14px #e8c27155,inset 0 0 12px #e8c27133;animation:evolution-ring .8s ease-out both}
@keyframes evolution-ring{0%{opacity:0;transform:scale(.35)}30%{opacity:.7}100%{opacity:0;transform:scale(1.15)}}
.evolution-surface svg{position:absolute;left:calc(10% + var(--i)*13%);width:6%;height:6%;opacity:0;animation:evolution-spark .65s ease-out both;animation-delay:calc(var(--i)*45ms)}
.evolution-surface.phase-gather svg{animation-name:evolution-gather}
.evolution-surface.phase-return svg{animation-direction:reverse;animation-duration:.4s}
@keyframes evolution-spark{0%{opacity:0;transform:translateY(16px) scale(.2)}45%{opacity:.8}100%{opacity:0;transform:translateY(-20px) scale(1)}}
@keyframes evolution-gather{0%{opacity:0;transform:translateY(-15px) scale(.7)}60%{opacity:.7}100%{opacity:0;transform:translateY(8px) scale(.2)}}
@media(prefers-reduced-motion:reduce){.evolution-surface svg,.evolution-ring{display:none!important}}
</style>
