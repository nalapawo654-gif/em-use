<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhHeart, PhSparkle } from '@phosphor-icons/vue'
import { moodFor } from '../shared/quota'
const props = defineProps<{ percent: number | null; reducedMotion?: boolean; night?: boolean; compact?: boolean; muted?: boolean }>()
const emit = defineEmits<{ interact: [kind: string] }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const host = ref<HTMLElement | null>(null)
const happy = ref(false), cleaning = ref(false), feeding = ref(false)
const mood = computed(() => moodFor(props.percent ?? 68))
let animation = 0, observer: ResizeObserver, visible = true, disposed = false, time = 0, lastFrame = 0
let target = { x: .28, y: .72 }, fish = { x: .28, y: .72 }, currentLevel = .68
let bowl: HTMLImageElement, empty: HTMLImageElement, clown: HTMLImageElement, fishSprite: HTMLCanvasElement | null = null
const timers: ReturnType<typeof setTimeout>[] = []
function later(fn: () => void, ms: number) { timers.push(setTimeout(fn, ms)) }
function love() { happy.value = true; emit('interact', 'love'); later(() => { happy.value = false }, 1700) }
function feed() { feeding.value = true; happy.value = true; target = { x: .45, y: .45 }; emit('interact', 'feed'); later(() => { feeding.value = false; happy.value = false }, 2600) }
function clean() { cleaning.value = true; emit('interact', 'clean'); later(() => { cleaning.value = false }, 1900) }
defineExpose({ feed, clean, love })
function follow(event: PointerEvent) {
  if (props.reducedMotion || !host.value) return
  const b = host.value.getBoundingClientRect()
  target = { x: Math.max(.27, Math.min(.69, (event.clientX - b.left) / b.width)), y: Math.max(.5, Math.min(.74, (event.clientY - b.top) / b.height)) }
}
function silhouette(ctx: CanvasRenderingContext2D, size: number) {
  // Mask the supplied raster to its glass outline; no illustration is drawn here.
  const p = new Path2D('M .204 .165 C .16 .20 .034 .365 .036 .553 C .025 .746 .105 .87 .23 .901 C .37 .945 .66 .945 .8 .898 C .92 .845 .969 .723 .965 .546 C .967 .386 .858 .213 .796 .165 L .799 .129 C .786 .079 .224 .077 .201 .128 Z')
  ctx.scale(size, size); ctx.clip(p); ctx.scale(1 / size, 1 / size)
}
function draw(now: number) {
  if (disposed) return
  animation = requestAnimationFrame(draw)
  if (!visible || document.hidden || now - lastFrame < (props.reducedMotion ? 250 : 33)) return
  const dt = Math.min(64, now - (lastFrame || now)); lastFrame = now
  if (!props.reducedMotion) time += dt / 1000
  const el = canvas.value, ctx = el?.getContext('2d')
  if (!el || !ctx || !bowl?.complete || !bowl.naturalWidth) return
  const w = el.width; ctx.clearRect(0, 0, w, w)
  currentLevel += ((props.percent === null ? .68 : Math.max(.04, props.percent / 100)) - currentLevel) * (props.reducedMotion ? 1 : .045)
  ctx.save(); silhouette(ctx, w)
  ctx.drawImage(empty?.naturalWidth ? empty : bowl, 0, 0, w, w)
  if (empty?.naturalWidth) {
    const top = .84 - .65 * Math.pow(currentLevel, .44)
    ctx.save()
    // Reposition the source's photographed water layer, retaining glass and garden below.
    const clip = new Path2D(); clip.moveTo(0, (top + .018) * w)
    for (let x = 0; x <= w; x += w / 60) clip.lineTo(x, (top + Math.sin(x / w * 11 + time * 1.1) * .005) * w)
    clip.lineTo(w, w); clip.lineTo(0, w); clip.closePath(); ctx.clip(clip)
    ctx.filter = mood.value === 'warning' ? 'hue-rotate(210deg) saturate(.9)' : mood.value === 'danger' ? 'hue-rotate(150deg) saturate(.72)' : (props.percent ?? 68) > 80 ? 'hue-rotate(-40deg)' : 'none'
    // Keep the glass and garden at their natural proportions as water recedes.
    // Only extend the source column for levels above its photographed surface.
    if (top < .27) {
      ctx.drawImage(bowl, 0, bowl.naturalHeight * .292, bowl.naturalWidth, bowl.naturalHeight * .548,
        0, top * w, w, (.84 - top) * w)
    } else ctx.drawImage(bowl, 0, 0, w, w)
    ctx.filter = 'none'; ctx.restore()
    // Source garden layer remains fixed while the waterline moves.
    ctx.drawImage(empty, 0, empty.naturalHeight * .80, empty.naturalWidth, empty.naturalHeight * .20, 0, w * .80, w, w * .20)
  }
  ctx.restore()
  if (clown?.complete && clown.naturalWidth) {
    fish.x += (target.x - fish.x) * .025; fish.y += (target.y - fish.y) * .025
    const low = props.percent !== null && props.percent < 25
    const y = low ? .79 : fish.y + Math.sin(time * 1.5) * .022
    const x = fish.x + Math.sin(time * .65) * .035
    const width = w * .245, height = width * clown.naturalHeight / clown.naturalWidth
    ctx.save(); ctx.translate(x * w, y * w); ctx.rotate(Math.sin(time) * .045)
    if (target.x < fish.x - .005) ctx.scale(-1, 1)
    ctx.drawImage(fishSprite ?? clown, -width / 2, -height / 2, width, height); ctx.restore()
    const sw = w * .16, sh = sw * clown.naturalHeight / clown.naturalWidth
    ctx.save(); ctx.translate((.63 + Math.sin(time * .7) * .06) * w, (low ? .8 : .75 + Math.sin(time * 1.3) * .012) * w); ctx.scale(-1, 1)
    ctx.drawImage(fishSprite ?? clown, -sw / 2, -sh / 2, sw, sh); ctx.restore()
  }
}
function prepareSprite(img: HTMLImageElement) {
  // Runtime matte mask: flood only the white studio background connected to the
  // border. Preserve enclosed white stripes and eyes. Original raster is untouched.
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const frame = ctx.getImageData(0, 0, c.width, c.height), pixels = frame.data, w = c.width, h = c.height
  const seen = new Uint8Array(w * h), queue = new Int32Array(w * h); let head = 0, tail = 0
  function add(i: number) {
    if (i < 0 || i >= w * h || seen[i]) return
    seen[i] = 1; const k = i * 4
    if (Math.min(pixels[k], pixels[k + 1], pixels[k + 2]) > 242) queue[tail++] = i
  }
  for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1) }
  while (head < tail) { const i = queue[head++]; pixels[i * 4 + 3] = 0; if (i % w) add(i - 1); if (i % w < w - 1) add(i + 1); add(i - w); add(i + w) }
  ctx.putImageData(frame, 0, 0); return c
}
// Public URLs must remain relative for the packaged file:// renderer.
onMounted(() => {
  bowl = new Image(); bowl.src = './assets/aquarium.png'
  empty = new Image(); empty.src = './assets/aquarium-empty.png'
  clown = new Image(); clown.onload = () => { fishSprite = prepareSprite(clown) }; clown.src = './assets/clownfish.png'
  observer = new ResizeObserver(entries => { if (canvas.value) { const size = Math.round(entries[0].contentRect.width * Math.min(devicePixelRatio, 2)); canvas.value.width = size; canvas.value.height = size } })
  if (host.value) observer.observe(host.value)
  animation = requestAnimationFrame(draw)
})
onUnmounted(() => { disposed = true; cancelAnimationFrame(animation); observer?.disconnect(); timers.forEach(clearTimeout) })
</script>

<template>
  <div ref="host" class="aquarium" :class="[{ night, muted, cleaning, compact, 'motion-off': reducedMotion }, mood]" @pointermove="follow" @pointerleave="target = { x: .28, y: .72 }">
    <canvas ref="canvas" class="bowl-canvas" aria-hidden="true" />
    <button class="fish-hit" aria-label="逗逗小鱼" @click="love" />
    <div class="quota-overlay" :class="{ empty: percent === null }">
      <div class="quota-number">{{ percent === null ? '—' : Math.round(percent) }}<span v-if="percent !== null">%</span></div>
      <div class="quota-caption">{{ percent === null ? '等你一起出发' : '今日剩余额度' }}</div>
      <slot />
    </div>
    <div v-if="happy" class="love-burst" aria-hidden="true"><PhHeart weight="fill"/><PhHeart weight="fill"/><PhHeart weight="fill"/></div>
    <div v-if="feeding" class="food-animation" aria-hidden="true"><PhSparkle weight="fill"/><PhSparkle weight="fill"/><PhSparkle weight="fill"/></div>
    <div v-if="cleaning" class="clean-animation" aria-hidden="true"><PhSparkle weight="fill"/><PhSparkle weight="fill"/></div>
  </div>
</template>
