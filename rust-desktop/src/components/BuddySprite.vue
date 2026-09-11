<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { buddySprite, buddyProp, type BuddyProp } from '../buddy/sprites'
import type { BuddySkin } from '../shared/types'
const props = withDefaults(defineProps<{ skin?: BuddySkin; level?: number; prop?: BuddyProp }>(), { skin: 'classic', level: 0 })
const canvas = ref<HTMLCanvasElement | null>(null), failed = ref(false)
let revision = 0
async function render() {
  const ticket = ++revision; failed.value = false
  try {
    const image = props.prop ? await buddyProp(props.prop) : await buddySprite(props.skin, props.level)
    if (ticket !== revision || !canvas.value) return
    canvas.value.width = image.width; canvas.value.height = image.height
    canvas.value.getContext('2d')!.drawImage(image, 0, 0)
  } catch { if (ticket === revision) failed.value = true }
}
onMounted(() => { void render() }); watch(() => [props.skin, props.level, props.prop], render)
onUnmounted(() => { revision++ })
</script>
<template><span class="buddy-sprite"><canvas ref="canvas" aria-hidden="true"/><span v-if="failed" class="buddy-asset-error" role="alert">物料加载失败<button @click.stop="render">重试</button></span></span></template>
