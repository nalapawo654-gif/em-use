<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhHeart, PhSparkle, PhX } from '@phosphor-icons/vue'
import type { Outfit } from '../shared/types'
import { loadImage, loadSprites, type Sprites, type SpriteName } from '../aquarium/sprites'
import { advancePlay, cleanCells, idlePlay, startPlay, waterTop, wipeAt, type PlayMode } from '../aquarium/play'
const props = defineProps<{ percent: number | null; outfit?: Outfit; reducedMotion?: boolean; night?: boolean; compact?: boolean; muted?: boolean }>()
const emit = defineEmits<{ interact: [kind: string] }>()
const canvas = ref<HTMLCanvasElement | null>(null), host = ref<HTMLElement | null>(null)
const play = ref(idlePlay()), happy = ref(false), failed = ref(false), treasureVisible = ref(false)
const wipeProgress = computed(() => Math.min(100, Math.round(play.value.cleaned.length / 42 * 100)))
const hint = computed(() => ({ idle: '', feed: '开饭啦，小鱼正在追着吃', hide: '数到三，小鱼藏好啦…', seek: '小鱼藏在哪？点点石头洞', reveal: '找到啦！送你一颗小爱心', clean: `按住拖动擦拭 · ${wipeProgress.value}%`, treasure: treasureVisible.value ? '一颗海蓝珍珠，送给专注的你' : '宝箱里好像藏着什么…', celebrate: '亮晶晶，擦干净啦' }[play.value.mode]))
const hiding = computed(() => ['hide', 'seek', 'reveal'].includes(play.value.mode))
let animation = 0, observer: ResizeObserver, disposed = false, time = 0, lastFrame = 0, heartUntil = 0, outfitSince = -1000
let fish = { x: .28, y: .77 }, target = { x: .28, y: .77 }, currentPercent = 68
let dayBowl: HTMLImageElement, dayEmpty: HTMLImageElement, nightBowl: HTMLImageElement, nightEmpty: HTMLImageElement, sprites: Sprites | undefined
let fog: HTMLCanvasElement | null = null, pointer: { x: number; y: number } | null = null, dragging = false, autoWipe = false, autoIndex = 0
const sceneNow = () => performance.now()
function begin(mode: PlayMode) {
  play.value = startPlay(mode, sceneNow()); dragging = false; autoWipe = false; pointer = null
  fog = null; happy.value = false; heartUntil = 0; target = { x: .28, y: .77 }
}
function cancel() { begin('idle') }
function love() {
  if (hiding.value) { reveal(); return }
  happy.value = true; heartUntil = sceneNow() + 1700; emit('interact', 'love')
}
function feed() { begin('feed'); emit('interact', 'feed') }
function clean() { if (play.value.mode === 'clean') { cancel(); return }; begin('clean'); emit('interact', 'clean-start') }
function hide() { if (hiding.value) reveal(); else { begin(props.reducedMotion ? 'seek' : 'hide'); emit('interact', 'hide') } }
function reveal() { begin('reveal'); happy.value = true; heartUntil = sceneNow() + 1800; emit('interact', 'found') }
function treasure() { begin('treasure'); emit('interact', 'treasure') }
function automaticClean() { autoWipe = true; autoIndex = 0 }
defineExpose({ feed, clean, love, hide, treasure, cancel })
watch(() => props.outfit, () => { happy.value = true; outfitSince = sceneNow(); heartUntil = outfitSince + 1700 })
function point(event: PointerEvent) {
  const b = host.value!.getBoundingClientRect()
  return { x: (event.clientX - b.left) / b.width, y: (event.clientY - b.top) / b.height }
}
function follow(event: PointerEvent) {
  const p = point(event)
  if (play.value.mode === 'clean') { if (dragging) wipe(p); else pointer = p; return }
  if (props.reducedMotion || play.value.mode !== 'idle') return
  target = { x: Math.max(.23, Math.min(.66, p.x)), y: Math.max(.68, Math.min(.79, p.y)) }
}
function startWipe(event: PointerEvent) {
  if (play.value.mode !== 'clean' || (event.target as HTMLElement).closest('.play-hud')) return
  event.preventDefault(); host.value?.setPointerCapture(event.pointerId); dragging = true; autoWipe = false; pointer = null; wipe(point(event))
}
function endWipe(event: PointerEvent) { dragging = false; if (host.value?.hasPointerCapture(event.pointerId)) host.value.releasePointerCapture(event.pointerId) }
function wipe(p: { x: number; y: number }) {
  const ctx = fog?.getContext('2d'), w = fog?.width ?? 1
  const prior = pointer ?? p, distance = Math.hypot(p.x - prior.x, p.y - prior.y), steps = Math.max(1, Math.ceil(distance / .035))
  for (let i = 1; i <= steps; i++) {
    play.value = wipeAt(play.value, prior.x + (p.x - prior.x) * i / steps, prior.y + (p.y - prior.y) * i / steps, sceneNow())
  }
  if (ctx) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = w * .19; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(prior.x * w, prior.y * w); ctx.lineTo(p.x * w + .01, p.y * w); ctx.stroke(); ctx.restore() }
  pointer = p
  if (play.value.mode === 'celebrate') { dragging = false; autoWipe = false; emit('interact', 'clean') }
}
function silhouette(ctx: CanvasRenderingContext2D, size: number) {
  const p = new Path2D('M .204 .165 C .16 .20 .034 .365 .036 .553 C .025 .746 .105 .87 .23 .901 C .37 .945 .66 .945 .8 .898 C .92 .845 .969 .723 .965 .546 C .967 .386 .858 .213 .796 .165 L .799 .129 C .786 .079 .224 .077 .201 .128 Z')
  ctx.scale(size, size); ctx.clip(p); ctx.scale(1 / size, 1 / size)
}
function drawSprite(ctx: CanvasRenderingContext2D, name: SpriteName, x: number, y: number, width: number, alpha = 1) {
  const img = sprites?.[name]; if (!img) return
  const height = width * img.height / img.width
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(img, x - width / 2, y - height / 2, width, height); ctx.restore()
}
function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, flip: boolean, scale = 1) {
  if (!sprites) return
  ctx.save(); ctx.translate(x, y); ctx.rotate(props.reducedMotion ? 0 : Math.sin(time * 2) * .035); ctx.scale((flip ? -1 : 1) * scale, scale)
  drawSprite(ctx, 'fish', 0, 0, width)
  const outfit = props.outfit ?? 'classic'
  const dressTime = Math.max(0, lastFrame - outfitSince)
  const pop = props.reducedMotion ? 1 : Math.min(1, dressTime / 180) * (1 + Math.sin(Math.PI * Math.min(1, dressTime / 500)) * .16)
  if (outfit !== 'classic') drawSprite(ctx, outfit, width * .08, width * (outfit === 'ribbon' ? .24 : -.32), width * (outfit === 'ribbon' ? .37 : .53) * pop)
  ctx.restore()
}
function draw(now: number) {
  if (disposed) return
  animation = requestAnimationFrame(draw)
  if (document.hidden || now - lastFrame < (props.reducedMotion ? 200 : 33)) return
  const dt = Math.min(100, now - (lastFrame || now)); lastFrame = now
  if (!props.reducedMotion) time += dt / 1000
  const before = play.value.mode; play.value = advancePlay(play.value, now)
  if (before === 'seek' && play.value.mode === 'reveal') emit('interact', 'peek')
  if (happy.value && now > heartUntil) happy.value = false
  const el = canvas.value, ctx = el?.getContext('2d')
  const bowl = props.night ? nightBowl : dayBowl, empty = props.night ? nightEmpty : dayEmpty
  if (!el || !ctx || !bowl || !empty) return
  const w = el.width, mode = play.value.mode, elapsed = now - play.value.since
  currentPercent += ((props.percent ?? 68) - currentPercent) * (props.reducedMotion ? 1 : .06)
  const top = waterTop(currentPercent), restingY = Math.min(.81, Math.max(.77, top + .095))
  ctx.clearRect(0, 0, w, w); ctx.save(); silhouette(ctx, w)
  ctx.drawImage(empty, 0, 0, w, w)
  ctx.save()
  const clip = new Path2D(); clip.moveTo(0, top * w)
  for (let x = 0; x <= w; x += w / 60) clip.lineTo(x, (top + Math.sin(x / w * 11 + time * 1.1) * .004) * w)
  clip.lineTo(w, w); clip.lineTo(0, w); clip.closePath(); ctx.clip(clip)
  // The original blue water is used at every allowance. Quota only changes its level.
  if (top < .27) ctx.drawImage(bowl, 0, bowl.naturalHeight * .292, bowl.naturalWidth, bowl.naturalHeight * .548, 0, top * w, w, (.84 - top) * w)
  else ctx.drawImage(bowl, 0, 0, w, w)
  ctx.restore()
  ctx.drawImage(empty, 0, empty.naturalHeight * .80, empty.naturalWidth, empty.naturalHeight * .20, 0, w * .80, w, w * .20)
  ctx.restore()
  // Scene objects share the fish's local coordinates and remain inside the glass.
  const chestOpen = mode === 'treasure' && elapsed > (props.reducedMotion ? 0 : 700)
  treasureVisible.value = chestOpen && (props.reducedMotion || elapsed > 2100)
  const shake = mode === 'treasure' && !chestOpen && !props.reducedMotion ? Math.sin(elapsed / 45) * .005 : 0
  const chestName = chestOpen ? 'chestOpen' : 'chest'
  const chestHeight = sprites ? .16 * sprites[chestName].height / sprites[chestName].width : .15
  drawSprite(ctx, chestName, (.59 + shake) * w, (.885 - chestHeight / 2) * w, .16 * w)
  if (chestOpen) {
    const progress = props.reducedMotion ? 1 : Math.min(1, (elapsed - 700) / 1400)
    drawSprite(ctx, 'pearl', (.59 + progress * .23) * w, (.79 - progress * .15) * w, .065 * w, Math.min(1, progress * 4))
  }
  let aim = { ...target, y: Math.max(target.y, restingY) }, scale = 1
  if (mode === 'feed') aim = { x: .42 + (props.reducedMotion ? 0 : Math.sin(elapsed / 350) * .08), y: restingY }
  if (hiding.value) {
    const p = Math.min(1, elapsed / 1100)
    aim = mode === 'reveal' ? { x: .42, y: restingY } : { x: .28, y: .80 }
    scale = mode === 'seek' ? .08 : props.reducedMotion ? 1 : mode === 'hide' ? 1 - p * .92 : .08 + p * .92
  }
  const smoothing = props.reducedMotion ? 1 : 1 - Math.exp(-dt / 240)
  fish.x += (aim.x - fish.x) * smoothing; fish.y += (aim.y - fish.y) * smoothing
  const bob = props.reducedMotion || hiding.value ? 0 : Math.sin(time * 1.7) * .012
  drawFish(ctx, fish.x * w, (fish.y + bob) * w, w * .20, aim.x < fish.x - .008, scale)
  if (hiding.value) {
    drawSprite(ctx, 'cave', .28 * w, .786 * w, .25 * w, mode === 'reveal' ? Math.max(0, 1 - elapsed / 1500) : 1)
    if (mode === 'seek') drawFish(ctx, .28 * w, .808 * w, w * .20, false, .27)
  }
  drawFish(ctx, (.73 + Math.sin(time * .7) * .018) * w, Math.max(.78, restingY) * w, w * .12, true)
  if (mode === 'clean') {
    if (!fog || fog.width !== w) {
      fog = document.createElement('canvas'); fog.width = w; fog.height = w
      const f = fog.getContext('2d')!; f.save(); f.beginPath(); f.ellipse(.5 * w, .55 * w, .405 * w, .33 * w, 0, 0, Math.PI * 2); f.clip()
      f.filter = `blur(${w * .016}px) brightness(1.12)`; f.globalAlpha = .86; f.drawImage(empty, 0, 0, w, w); f.restore()
      // Reapply completed cells if the native window changes size mid-cleaning.
      f.globalCompositeOperation = 'destination-out'; f.lineWidth = w * .19; f.lineCap = 'round'
      for (const i of play.value.cleaned) { const p = cleanCells[i]; f.beginPath(); f.moveTo(p.x * w, p.y * w); f.lineTo(p.x * w + .01, p.y * w); f.stroke() }
      f.globalCompositeOperation = 'source-over'
    }
    if (autoWipe) {
      const count = props.reducedMotion ? 48 : 1
      for (let i = 0; i < count && autoIndex < cleanCells.length && play.value.mode === 'clean'; i++) {
        const row = Math.floor(autoIndex / 8), col = autoIndex % 8, cell = row * 8 + (row % 2 ? 7 - col : col)
        wipe(cleanCells[cell]); autoIndex++
      }
    }
    ctx.drawImage(fog, 0, 0)
    const pos = pointer ?? { x: .70, y: .58 }; drawSprite(ctx, 'sponge', pos.x * w, pos.y * w, .15 * w)
  }
}
function keyboard(event: KeyboardEvent) { if (event.key === 'Escape') { cancel(); return }; if (event.target === host.value && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); play.value.mode === 'clean' ? automaticClean() : love() } }
onMounted(async () => {
  observer = new ResizeObserver(entries => { if (canvas.value) { const size = Math.round(entries[0].contentRect.width * Math.min(devicePixelRatio, 2)); if (size !== canvas.value.width || size !== canvas.value.height) { canvas.value.width = size; canvas.value.height = size } } })
  if (host.value) observer.observe(host.value)
  try { [dayBowl, dayEmpty, nightBowl, nightEmpty, sprites] = await Promise.all([loadImage('./assets/aquarium.png'), loadImage('./assets/aquarium-empty.png'), loadImage('./assets/aquarium-night.png'), loadImage('./assets/aquarium-empty-night.png'), loadSprites()]); if (!disposed) animation = requestAnimationFrame(draw) }
  catch { failed.value = true }
})
onUnmounted(() => { disposed = true; cancelAnimationFrame(animation); observer?.disconnect() })
</script>

<template>
  <div ref="host" class="aquarium" :class="{ night, muted, compact, 'motion-off': reducedMotion, 'is-wiping': play.mode === 'clean', 'low-water': percent !== null && percent < 45 }" :data-play="play.mode" :data-treasure="treasureVisible ? 'revealed' : 'closed'" tabindex="0" aria-label="小鱼缸互动区域" @keydown="keyboard" @pointerdown="startWipe" @pointermove="follow" @pointerup="endWipe" @pointercancel="endWipe" @lostpointercapture="dragging = false" @pointerleave="target = { x: .28, y: .77 }">
    <canvas ref="canvas" class="bowl-canvas" aria-hidden="true" />
    <button v-if="play.mode !== 'clean'" class="fish-hit" aria-label="逗逗小鱼" @click="love" />
    <button v-if="!hiding && play.mode !== 'clean'" class="treasure-hit scene-hit" aria-label="打开宝箱" title="打开宝箱" @click="treasure" />
    <button v-if="hiding" class="cave-hit scene-hit" aria-label="找到小鱼" title="找到小鱼" @click="reveal" />
    <div class="quota-overlay" :class="{ empty: percent === null }"><div class="quota-number">{{ percent === null ? '—' : Math.round(percent) }}<span v-if="percent !== null">%</span></div><div class="quota-caption">{{ percent === null ? '等你一起出发' : '今日剩余额度' }}</div><slot /></div>
    <div v-if="hint" class="play-hud" @pointerdown.stop><span role="status">{{ hint }}</span><button v-if="play.mode === 'clean'" @click="automaticClean">自动擦拭</button><button class="finish-play" aria-label="结束互动" @click="cancel"><PhX/></button></div>
    <div v-if="failed" class="play-hud" role="alert">素材加载失败，请重新打开小鱼缸</div>
    <div v-if="happy || play.mode === 'reveal'" class="love-burst" aria-hidden="true"><PhHeart weight="fill"/><PhHeart weight="fill"/><PhHeart weight="fill"/></div>
    <div v-if="play.mode === 'feed'" class="food-animation" aria-hidden="true"><PhSparkle weight="fill"/><PhSparkle weight="fill"/><PhSparkle weight="fill"/></div>
    <div v-if="play.mode === 'celebrate'" class="clean-animation" aria-hidden="true"><PhSparkle weight="fill"/><PhSparkle weight="fill"/></div>
  </div>
</template>
