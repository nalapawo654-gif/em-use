<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { chickenMotion, chickenFrame } from '../basketball/chicken'

// Keep legacy skin values readable; the supplied character has one original outfit.
const props = withDefaults(defineProps<{ skin?: string; pose?: string; gentle?: boolean; awake?: boolean }>(), { skin: 'home', pose: 'idle' })
const elapsed = ref(0), hidden = ref(true), failed = ref(false)
const motion = computed(() => chickenMotion(props.pose))
const frame = computed(() => chickenFrame(props.pose, elapsed.value, props.gentle))
const viewBox = computed(() => `${frame.value * 192 + 18} ${motion.value.row * 208} 156 208`)
let timer: ReturnType<typeof setInterval> | undefined
function stop() { clearInterval(timer); timer = undefined }
function sync() {
  stop()
  if (!hidden.value && !props.gentle && !failed.value) timer = setInterval(() => { elapsed.value += 120 }, 120)
}
function visibility() { hidden.value = document.hidden; sync() }
watch(() => props.pose, () => { elapsed.value = 0 })
watch([() => props.gentle, failed], sync)
onMounted(() => { visibility(); document.addEventListener('visibilitychange', visibility) })
onUnmounted(() => { stop(); document.removeEventListener('visibilitychange', visibility) })
</script>
<template>
  <svg viewBox="0 0 110 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="hoop-player hoop-chicken" :class="['pose-' + pose, { 'player-gentle': gentle, 'player-awake': awake }]" :data-sprite-row="motion.row" :data-sprite-frame="frame">
    <!-- Clip the original atlas at runtime: no recolouring, stretching or remote dependency. -->
    <svg v-if="!failed" x="0" y="0" width="110" height="140" :viewBox="viewBox" preserveAspectRatio="xMidYMax meet" overflow="hidden">
      <image href="/assets/basketball/jige/spritesheet.webp" width="1536" height="1872" @error="failed = true"/>
    </svg>
    <g v-else fill="currentColor" text-anchor="middle" font-size="10"><text x="55" y="65">小鸡素材加载失败</text><text x="55" y="81">请重新打开桌宠</text></g>
  </svg>
</template>
