<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhHeart, PhSparkle, PhDrop, PhCircle, PhMoon, PhX, PhArrowCounterClockwise } from '@phosphor-icons/vue'
import type { BuddySkin } from '../shared/types'
import { ACTION_LABELS, BUDDY_STATES, advanceBuddy, beginBuddy, buddyCleanCells, buddyIdle, buddyLevel, scrubBuddy, type BuddyAction } from '../buddy/play'
import BuddySprite from './BuddySprite.vue'
import BuddyActor from './BuddyActor.vue'
import { money } from '../shared/quota'
const props = defineProps<{ percent: number | null; remaining?: number; limit?: number; skin: BuddySkin; night: boolean; reducedMotion: boolean; muted?: boolean }>()
const host = ref<HTMLElement | null>(null), play = ref(buddyIdle()), resting = ref(false), autoClean = ref(false)
const brush = ref({ x: .64, y: .45 }), elapsed = ref(0)
const level = computed(() => buddyLevel(props.percent))
const pose = computed(() => ['sleep', 'rest'].includes(play.value.mode) || resting.value ? Math.max(2, level.value) : level.value)
const progress = computed(() => Math.min(100, Math.round(play.value.cleaned.length / 18 * 100)))
const hint = computed(() => play.value.mode === 'clean' ? `按住拖动刷洗 · ${progress.value}%` : ACTION_LABELS[play.value.mode])
const speech = computed(() => props.percent === null ? '等你连上账户\n再一起元气开工' : BUDDY_STATES[level.value].speech)
const frame = computed(() => play.value.mode === 'inflate' && !props.reducedMotion ? Math.max(level.value, 3 - Math.floor(elapsed.value / 1200)) : pose.value)
let timer: ReturnType<typeof setInterval>, clickTimer: ReturnType<typeof setTimeout> | undefined
let dragging = false, previous: { x: number; y: number } | undefined, autoIndex = 0, nextIdle = 0
const now = () => performance.now()
function act(mode: BuddyAction) {
  clearTimeout(clickTimer); dragging = false; previous = undefined; autoClean.value = false; autoIndex = 0
  play.value = beginBuddy(mode, now()); elapsed.value = 0
  nextIdle = now() + 13000 + Math.random() * 9000
}
function cancel() { act('idle') }
function pet() { if (play.value.mode === 'clean') return; clearTimeout(clickTimer); clickTimer = setTimeout(() => act('pet'), 240) }
function togglePose() { clearTimeout(clickTimer); cancel(); resting.value = !resting.value }
function point(event: PointerEvent) { const b = host.value!.getBoundingClientRect(); return { x: (event.clientX - b.left) / b.width, y: (event.clientY - b.top) / b.height } }
function wipe(p: { x: number; y: number }) {
  const prior = previous ?? p, steps = Math.max(1, Math.ceil(Math.hypot(p.x - prior.x, p.y - prior.y) / .025))
  for (let i = 1; i <= steps; i++) play.value = scrubBuddy(play.value, prior.x + (p.x - prior.x) * i / steps, prior.y + (p.y - prior.y) * i / steps, now())
  brush.value = p; previous = p
  if (play.value.mode !== 'clean') { dragging = false; autoClean.value = false }
}
function down(event: PointerEvent) {
  if (play.value.mode !== 'clean' || (event.target as HTMLElement).closest('.buddy-hud')) return
  event.preventDefault(); dragging = true; autoClean.value = false; previous = undefined
  host.value?.setPointerCapture(event.pointerId); wipe(point(event))
}
function move(event: PointerEvent) { if (play.value.mode !== 'clean') return; const p = point(event); if (dragging) wipe(p); else brush.value = p }
function up(event: PointerEvent) { dragging = false; previous = undefined; if (host.value?.hasPointerCapture(event.pointerId)) host.value.releasePointerCapture(event.pointerId) }
function automatic() { autoIndex = 0; autoClean.value = true; previous = undefined }
defineExpose({ updateBlocked: computed(() => play.value.mode !== 'idle'), act, cancel, togglePose })
watch(() => props.skin, () => { resting.value = false; act('wag') })
watch(() => props.percent, (value, old) => { if (value !== null && old !== null && value > old + 15) act('inflate') })
onMounted(() => {
  nextIdle = now() + 13000 + Math.random() * 8000
  timer = setInterval(() => {
    if (document.hidden) return
    const t = now(); elapsed.value = Math.max(0, t - play.value.since)
    play.value = advanceBuddy(play.value, t, props.reducedMotion)
    if (autoClean.value && play.value.mode === 'clean') { wipe(buddyCleanCells[autoIndex % buddyCleanCells.length]); autoIndex++ }
    if (play.value.mode === 'idle' && !props.reducedMotion && t >= nextIdle) act(level.value >= 2 || resting.value ? 'sleep' : Math.random() > .5 ? 'wag' : 'shake')
  }, 100)
})
onUnmounted(() => { clearInterval(timer); clearTimeout(clickTimer); dragging = false })
</script>

<template>
  <div ref="host" class="buddy-scene" :class="[{ night, muted, 'motion-off': reducedMotion, 'is-wiping': play.mode === 'clean' }, 'level-' + level, 'action-' + play.mode]" :data-action="play.mode" :data-level="level" :data-pose="pose >= 2 ? 'lying' : 'standing'" :data-skin="skin" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="dragging = false" @keydown.esc="cancel">
    <BuddySprite prop="ground" class="buddy-ground"/>
    <div class="buddy-speech">{{ speech }}<PhHeart weight="regular"/></div>
    <div class="buddy-sign"><BuddySprite prop="sign"/><div class="buddy-sign-copy"><span>剩余额度</span><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong><span v-if="percent !== null && remaining !== undefined && limit !== undefined">¥{{ money(remaining) }} / ¥{{ money(limit) }}</span><span v-else>等待连接</span></div></div>
    <button class="buddy-actor scene-hit" aria-label="摸摸牛马，双击切换站立或趴下" @click="pet" @dblclick.prevent="togglePose" @keydown.enter.prevent="act('pet')" @keydown.space.prevent="act('pet')"><BuddyActor :skin="skin" :level="frame" :action="play.mode" :since="play.since" :reduced-motion="reducedMotion"/></button>
    <div class="buddy-fx" aria-hidden="true">
      <BuddySprite v-if="play.mode === 'clean'" prop="brush" class="action-prop prop-brush" :style="{ left: `${brush.x * 100}%`, top: `${brush.y * 100}%` }"/>
      <template v-if="play.mode === 'clean'"><PhCircle v-for="i in 9" :key="i" class="wash-bubble" :style="{ left: `${32 + (i * 7) % 48}%`, top: `${28 + (i * 11) % 40}%`, animationDelay: `${i * -.3}s`, opacity: .3 + (1 - progress / 100) * .65 }"/></template>
      <template v-if="play.mode === 'pet' || play.mode === 'wag'"><PhHeart v-for="i in 3" :key="i" weight="fill" class="buddy-heart" :style="{ left: `${30 + i * 11}%`, animationDelay: `${i * .18}s` }"/></template>
      <template v-if="play.mode === 'celebrate' || play.mode === 'shake'"><PhSparkle v-for="i in 4" :key="i" weight="fill" class="buddy-sparkle" :style="{ left: `${20 + i * 15}%`, top: `${35 + i % 2 * 24}%`, animationDelay: `${i * .1}s` }"/></template>
      <PhMoon v-if="play.mode === 'sleep'" class="buddy-sleep-icon" weight="duotone"/>
    </div>
    <div v-if="play.mode !== 'idle'" class="buddy-hud" @pointerdown.stop><span role="status">{{ hint }}</span><button v-if="play.mode === 'clean'" @click="automatic">自动清洁</button><button aria-label="结束牛马互动" @click="cancel"><PhX/></button></div>
    <div class="buddy-motto">牛马不倒，额度管够！<PhHeart/></div>
    <button v-if="resting && play.mode === 'idle'" class="buddy-stand" @click="togglePose"><PhArrowCounterClockwise/>{{ level >= 2 ? '恢复自动姿态' : '站起来' }}</button>
  </div>
</template>
