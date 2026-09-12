<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { feiduduFrame, type FeiduduAction } from '../feidudu/play'
import { loadFeidudu } from '../feidudu/sprites'
import { hasFeiduduTint, tintFeiduduPixels } from '../feidudu/skins'
import { chooseFeiduduMotion, feiduduMotionDelay, feiduduAmbientFrame, motionEnvelope, FEIDUDU_MOTIONS, type FeiduduMotion } from '../feidudu/ambient'
import { createFeiduduMotionRenderer } from '../feidudu/motionRenderer'
import type { FeiduduSkin } from '../shared/types'
const props = withDefaults(defineProps<{ percent?: number | null; action?: FeiduduAction; skin?: FeiduduSkin; gentle?: boolean; paused?: boolean; frame?: number; ambient?: boolean }>(), { percent: null, action: 'idle', skin: 'classic' })
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
  if (ctx && source) { ctx.clearRect(0, 0, 512, 512); ctx.drawImage(source, 0, 0) }
}
function prepare() {
  const original = frames[index.value]
  source = undefined; renderMotion = null; freeHands = undefined
  if (!original) return
  source = tintedFrame(original)
  draw()
}
function tintedFrame(original: HTMLCanvasElement) {
  const tinted = document.createElement('canvas'); tinted.width = tinted.height = 512
  const ctx = tinted.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(original, 0, 0)
  if (hasFeiduduTint(props.skin)) {
    const pixels = ctx.getImageData(0, 0, 512, 512)
    tintFeiduduPixels(pixels.data, props.skin); ctx.putImageData(pixels, 0, 0)
  }
  return tinted
}
function stop() { clearTimeout(timeout); timeout = undefined; cancelAnimationFrame(raf); raf = 0; motion.value = null; draw() }
function schedule(first = false) {
  if (!enabled.value || disposed) return
  timeout = setTimeout(() => {
    if (!enabled.value || !source || disposed) return
    const chosen = chooseFeiduduMotion(index.value, previous)
    if (!chosen) return
    renderMotion ??= createFeiduduMotionRenderer(source, frames[index.value]!, index.value)
    const ctx = canvas.value?.getContext('2d')
    if (!ctx || !renderMotion) return
    const pose = feiduduAmbientFrame(index.value, chosen)
    if (pose !== index.value && !freeHands) {
      const alternate = tintedFrame(frames[pose]!), buffer = document.createElement('canvas')
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
watch(() => [index.value, props.skin, enabled.value], reset)
onUnmounted(() => { disposed = true; stop(); media.removeEventListener('change', systemMotionChanged) })
</script>
<template>
  <div class="feidudu-visual" :class="['skin-' + skin, 'action-' + action, { gentle: gentle || systemGentle, paused, 'ambient-active': motion }]" :data-motion="motion" :data-frame="index" :data-loaded="loaded">
    <canvas ref="canvas" class="feidudu-sprite" width="512" height="512" aria-hidden="true"></canvas>
    <span v-if="!loaded && !failed" class="feidudu-load" role="status">肥嘟嘟慢慢走来…</span>
    <span v-if="failed" class="feidudu-load" role="alert">肥嘟嘟素材加载失败，请重新打开场景。</span>
  </div>
</template>
