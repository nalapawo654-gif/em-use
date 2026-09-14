<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhHeart, PhSparkle, PhX, PhMusicNote } from '@phosphor-icons/vue'
import BeaverSprite from './BeaverSprite.vue'
import BeaverVisual from './BeaverVisual.vue'
import { advanceBeaver, beaverIdle, beaverLevel, beginBeaver, collectLeaf, groomStroke, BEAVER_HINTS, BEAVER_STATES, BEAVER_MOTTOS, type BeaverAction } from '../beaver/play'
import type { BeaverSkin, Settings } from '../shared/types'
import { money } from '../shared/quota'
const props = defineProps<{ percent: number | null; remaining?: number; limit?: number; skin: BeaverSkin; night: boolean; reducedMotion: boolean; camp: boolean; motto: Settings['beaverMotto']; muted: boolean }>()
const host = ref<HTMLElement>(), play = ref(beaverIdle()), elapsed = ref(0), brushing = ref(false), brush = ref({ x: .48, y: .55 })
const level = computed(() => beaverLevel(props.percent))
const progress = computed(() => Math.min(100, Math.round(play.value.strokes / 1.5 * 100)))
const hint = computed(() => play.value.mode === 'groom' ? `${BEAVER_HINTS.groom} · ${progress.value}%` : play.value.mode === 'leaves' ? `${BEAVER_HINTS.leaves} · ${play.value.collected.length}/3` : BEAVER_HINTS[play.value.mode])
const leaves = [{ x: .29, y: .24 }, { x: .60, y: .30 }, { x: .79, y: .48 }]
let suppressPetUntil = 0
let timer: ReturnType<typeof setInterval>, pointer: number | null = null, previous: { x: number; y: number } | undefined
function release() { if (pointer !== null) suppressPetUntil = performance.now() + 400; if (pointer !== null && host.value?.hasPointerCapture(pointer)) host.value.releasePointerCapture(pointer); pointer = null; previous = undefined; brushing.value = false }
function act(mode: BeaverAction) { release(); play.value = beginBeaver(mode, performance.now()); elapsed.value = 0 }
function cancel() { act('idle') }
function point(event: PointerEvent) { const rect = host.value!.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height } }
function overFur(p: { x: number; y: number }) { return p.x > .24 && p.x < .64 && p.y > .51 && p.y < .88 }
function down(event: PointerEvent) {
  if (play.value.mode !== 'groom' || event.button !== 0 || !overFur(point(event)) || (event.target as HTMLElement).closest('.beaver-hud')) return
  event.preventDefault(); pointer = event.pointerId; brushing.value = true; previous = point(event); brush.value = previous; host.value?.setPointerCapture(pointer)
}
function move(event: PointerEvent) {
  if (play.value.mode !== 'groom') return
  const p = point(event); brush.value = p
  if (pointer !== event.pointerId) return
  if (previous && overFur(p) && overFur(previous)) play.value = groomStroke(play.value, Math.hypot(p.x - previous.x, p.y - previous.y), performance.now())
  previous = p
  if (play.value.mode !== 'groom') release()
}
function takeLeaf(id: number) { play.value = collectLeaf(play.value, id, performance.now()) }
function pet() { if (performance.now() < suppressPetUntil) return; if (play.value.mode !== 'groom') act('pet') }
onMounted(() => { timer = setInterval(() => { if (document.hidden) return; elapsed.value = performance.now() - play.value.since; play.value = advanceBeaver(play.value, performance.now(), props.reducedMotion) }, 80); window.addEventListener('blur', release) })
onUnmounted(() => { clearInterval(timer); release(); window.removeEventListener('blur', release) })
watch(() => play.value.mode, (mode) => { if ((mode === 'celebrate' || mode === 'idle') && host.value?.contains(document.activeElement)) void nextTick(() => host.value?.focus({ preventScroll: true })) })
defineExpose({ updateBlocked: computed(() => play.value.mode !== 'idle'), act, cancel })
</script>
<template>
  <div ref="host" tabindex="-1" class="beaver-scene" :class="[{ night, muted, 'motion-off': reducedMotion, 'is-grooming': play.mode === 'groom' }, 'beaver-level-' + level, 'beaver-action-' + play.mode]" :data-action="play.mode" :data-level="level" :data-pet-gesture="play.mode === 'groom' ? 'groom' : undefined" @pointerdown="down" @pointermove="move" @pointerup="release" @pointercancel="release" @lostpointercapture="release">
    <BeaverSprite prop="ground" class="beaver-ground"/>
    <BeaverVisual message :level="level" :skin="skin" :action="play.mode" :since="play.since" :reduced-motion="reducedMotion"/>
    <div class="beaver-quota"><BeaverSprite prop="sign"/><div class="beaver-quota-copy"><span>今日剩余额度</span><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong><div v-if="percent !== null" class="beaver-meter"><i :style="{ width: `${percent}%` }"/></div><small>{{ percent !== null && remaining !== undefined && limit !== undefined ? `¥${money(remaining)} / ¥${money(limit)}` : '等待连接账户' }}</small></div></div>
    <button class="beaver-actor scene-hit" aria-label="摸摸海狸鼠" @click="pet" @keydown.enter.prevent="pet" @keydown.space.prevent="pet"></button>
    <p class="beaver-speech">{{ percent === null ? '小伙伴已就位，等你连上账户' : BEAVER_STATES[level].hint }}</p>
    <div class="beaver-motto"><span>{{ BEAVER_MOTTOS[motto] }}</span></div>
    <BeaverSprite v-if="camp" prop="tent" class="beaver-tent"/>
    <div class="beaver-action-art" aria-hidden="true">
      <BeaverSprite v-if="play.mode === 'groom'" prop="brush" class="beaver-brush" :class="{ brushing }" :style="{ left: `${brush.x * 100}%`, top: `${brush.y * 100}%` }"/>
      <PhHeart v-for="i in (play.mode === 'pet' || play.mode === 'groom' ? 3 : 0)" :key="`heart${i}`" class="beaver-heart" weight="fill" :style="{ left: `${35 + i * 8}%`, animationDelay: `${i * .25}s` }"/>
      <PhSparkle v-for="i in (play.mode === 'celebrate' ? 5 : 0)" :key="`star${i}`" class="beaver-star" weight="fill" :style="{ left: `${20 + i * 12}%`, top: `${25 + i % 2 * 13}%` }"/>
      <PhMusicNote v-if="play.mode === 'bird'" class="beaver-note"/>
    </div>
    <template v-if="play.mode === 'leaves'"><button v-for="(leaf, id) in leaves" v-show="!play.collected.includes(id)" :key="id" class="beaver-leaf-hit" :aria-label="`收集第${id + 1}片树叶`" :style="{ left: `${leaf.x * 100}%`, top: `${leaf.y * 100}%` }" @click="takeLeaf(id)"><BeaverSprite prop="leaf"/></button></template>
    <div v-if="play.mode !== 'idle'" class="beaver-hud" @pointerdown.stop><span role="status">{{ hint }}</span><button aria-label="结束海狸鼠互动" @click="cancel"><PhX/></button></div>
  </div>
</template>
