<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { loadSkadiCat } from '../skadi/sprites'
const props = withDefaults(defineProps<{ active?: boolean; asleep?: boolean; gentle?: boolean; paused?: boolean }>(), { active: false, asleep: false, gentle: false, paused: false })
const frames = ref<string[]>([]), error = ref(false)
let disposed = false, timer: ReturnType<typeof setInterval> | undefined
const age = ref(0)
const frame = computed(() => props.asleep ? 2 : props.active ? 3 : props.gentle || props.paused ? 0 : age.value % 27000 > 24900 ? 5 : age.value % 18000 > 16000 ? 4 : age.value % 6400 > 6160 ? 1 : 0)
onMounted(async () => { timer = setInterval(() => { if (!document.hidden && !props.paused && !props.gentle) age.value += 120 }, 120); try { const result = await loadSkadiCat(); if (!disposed) frames.value = result } catch { if (!disposed) error.value = true } })
onUnmounted(() => { disposed = true; clearInterval(timer) })
</script>
<template><div class="skadi-cat" :class="{ active, asleep, gentle, paused }" :data-loaded="!!frames.length" aria-hidden="true"><img v-if="frames.length" :src="frames[frame]" alt="" draggable="false"/><span v-else-if="error" class="skadi-cat-error">夜影暂未到达</span><span v-if="active" class="skadi-cat-love">♡</span></div></template>
