<script setup lang="ts">
import { useAwakenedArt } from '../evolution/useAwakenedArt'
import { energyFrame } from '../evolution/atlas'
import { useAwakeningProps, paintInteraction } from '../evolution/interactionArt'
import { drawAwakenedMotion } from '../evolution/wholeMotion'
import { vEvolutionMaterial } from '../evolution/material'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { feiduduFrame, type FeiduduAction } from '../feidudu/play'
import { loadFeidudu } from '../feidudu/sprites'
import { hasFeiduduTint, tintFeiduduPixels } from '../feidudu/skins'
import { chooseFeiduduMotion, feiduduMotionDelay, feiduduAmbientFrame, motionEnvelope, FEIDUDU_MOTIONS, type FeiduduMotion } from '../feidudu/ambient'
import { createFeiduduMotionRenderer } from '../feidudu/motionRenderer'
import { useCharacterMail } from '../shared/characterMail'
import { renderFeiduduMail } from '../feidudu/mail'
import type { FeiduduSkin } from '../shared/types'
const props = withDefaults(defineProps<{ message?: boolean; percent?: number | null; action?: FeiduduAction; skin?: FeiduduSkin; gentle?: boolean; paused?: boolean; frame?: number; ambient?: boolean }>(), { percent: null, action: 'idle', skin: 'classic' })
const { art: awakened } = useAwakenedArt('feidudu',()=>props.skin)
const interactionArt=useAwakeningProps()
const mail=useCharacterMail()
const carrying=computed(()=>props.message&&mail?.active.value)
const canvas = ref<HTMLCanvasElement>(), loaded = ref(false), failed = ref(false), motion = ref<FeiduduMotion | null>(null)
const index = computed(() => props.frame ?? feiduduFrame(props.percent, props.action))
const media = window.matchMedia('(prefers-reduced-motion: reduce)'), systemGentle = ref(media.matches)
const enabled = computed(() => props.ambient && props.action === 'idle' && !props.gentle && !systemGentle.value && !props.paused && loaded.value)
let frames: HTMLCanvasElement[] = [], disposed = false, source: HTMLCanvasElement | undefined
let renderMotion: ReturnType<typeof createFeiduduMotionRenderer> = null
let freeHands: { canvas: HTMLCanvasElement; render: ReturnType<typeof createFeiduduMotionRenderer> } | undefined
let timeout: ReturnType<typeof setTimeout> | undefined, raf = 0, previous: FeiduduMotion | null = null
function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (ctx && source) { ctx.clearRect(0, 0, 512, 512); ctx.drawImage(source, 0, 0); if(carrying.value){if(awakened.value)mail!.paint(ctx,{x:320,y:305,width:100,height:140},'propped',undefined,'contain');else renderFeiduduMail(ctx,source,index.value,mail!.paint)};if(awakened.value)paintInteraction(ctx,interactionArt.value,props.action==='rest'?'idle':props.action) }
}
function prepare() {
  const pose=props.action==='rest'?4:props.action==='belly'?2:props.action==='idle'?energyFrame(props.percent,5):props.action==='tea'?1:0
  const original = awakened.value?.frames[pose] ?? frames[index.value]
  source = undefined; renderMotion = null; freeHands = undefined
  if (!original) return
  source = tintedFrame(original)
  draw()
}
function tintedFrame(original: HTMLCanvasElement, pose = index.value) {
  const tinted = document.createElement('canvas'); tinted.width = tinted.height = 512
  const ctx = tinted.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(original, 0, 0)
  if (!awakened.value && hasFeiduduTint(props.skin)) {
    const pixels = ctx.getImageData(0, 0, 512, 512)
    tintFeiduduPixels(pixels.data, props.skin); ctx.putImageData(pixels, 0, 0)
  }
  ctx.save();ctx.globalCompositeOperation='destination-over';ctx.restore()

  return tinted
}
function stop() { clearTimeout(timeout); timeout = undefined; cancelAnimationFrame(raf); raf = 0; motion.value = null; draw() }
function schedule(first = false) {
  if (!enabled.value || disposed) return
  timeout = setTimeout(() => {
    if (!enabled.value || !source || disposed) return
    let chosen = chooseFeiduduMotion(index.value, previous)
    // While carrying mail, keep eye/ear/head gestures; reserve free-hand gestures
    // for explicit interactions, whose authored pose has its own mail placement.
    if(carrying.value&&chosen&&['belly','yawn','stretch','foot'].includes(chosen)){
      const quiet:FeiduduMotion[]=['eyes','ears','blink','sniff','nod'].filter(value=>value!==previous) as FeiduduMotion[]
      chosen=quiet[Math.floor(Math.random()*quiet.length)]!
    }
    if (!chosen) return
    renderMotion ??= awakened.value ? (ctx,motion,progress,variation)=>drawAwakenedMotion(ctx,source!,motion,progress,variation) : createFeiduduMotionRenderer(source, frames[index.value]!, index.value)
    const ctx = canvas.value?.getContext('2d')
    if (!ctx || !renderMotion) return
    const pose = feiduduAmbientFrame(index.value, chosen)
    if (!awakened.value && pose !== index.value && !freeHands) {
      const alternate = tintedFrame(frames[pose]!,pose), buffer = document.createElement('canvas')
      buffer.width = buffer.height = 512
      freeHands = { canvas: buffer, render: createFeiduduMotionRenderer(alternate, frames[pose]!, pose) }
    }
    const alternate = pose !== index.value ? freeHands : undefined
    previous = chosen; motion.value = chosen
    const start = performance.now(), duration = FEIDUDU_MOTIONS[chosen].duration * (.88 + Math.random() * .24), variation = Math.random() < .5 ? -1 : 1
    let last = -Infinity
    function tick(now: number) {
      if (!enabled.value || disposed) { stop(); return }
      const progress = (now - start) / duration
      if (progress >= 1) { motion.value = null; raf = 0; draw(); schedule(); return }
      if (now - last >= 1000 / 30) {
        if (alternate?.render) {
          alternate.render(alternate.canvas.getContext('2d')!, chosen!, progress, variation)
          ctx!.clearRect(0, 0, 512, 512); ctx!.save(); ctx!.globalAlpha = 1 - motionEnvelope(progress); ctx!.drawImage(source!, 0, 0); ctx!.globalAlpha = motionEnvelope(progress); ctx!.drawImage(alternate.canvas, 0, 0); ctx!.restore()
        } else renderMotion!(ctx!, chosen!, progress, variation)
        if(carrying.value){if(awakened.value)mail!.paint(ctx!,{x:320,y:305,width:100,height:140},'propped',undefined,'contain');else renderFeiduduMail(ctx!,source!,index.value,mail!.paint)}
        last = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }, feiduduMotionDelay(Math.random, first))
}
function reset() { stop(); prepare(); schedule(true) }
function systemMotionChanged() { systemGentle.value = media.matches }
onMounted(async () => {

  media.addEventListener('change', systemMotionChanged)
  try { const images = await loadFeidudu(); if (!disposed) { frames = images; loaded.value = true; prepare() } }
  catch { if (!disposed) failed.value = true }
})
watch(() => [awakened.value, interactionArt.value, index.value, props.action, props.skin, enabled.value, carrying.value], reset)
onUnmounted(() => { disposed = true; stop(); media.removeEventListener('change', systemMotionChanged) })
</script>
<template>
  <div class="evolution-equipped feidudu-visual" :class="['skin-' + skin, 'action-' + action, { gentle: gentle || systemGentle, paused, 'ambient-active': motion }]" :data-motion="motion" :data-frame="index" :data-loaded="loaded">
    <canvas :data-awakened="!!awakened" v-evolution-material="{ scene: 'feidudu', skin, pose: action, percent }" ref="canvas" class="feidudu-sprite" width="512" height="512" aria-hidden="true"></canvas>
    <span v-if="!loaded && !failed" class="feidudu-load" role="status">肥嘟嘟慢慢走来…</span>
    <span v-if="failed" class="feidudu-load" role="alert">肥嘟嘟素材加载失败，请重新打开场景。</span>
  </div>
</template>
