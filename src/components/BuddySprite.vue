<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { buddySprite, buddyProp, type BuddyProp } from '../buddy/sprites'
import type { BuddySkin } from '../shared/types'
const props = withDefaults(defineProps<{ skin?: BuddySkin; level?: number; prop?: BuddyProp; wag?: boolean }>(), { skin: 'classic', level: 0, wag: false })
const canvas = ref<HTMLCanvasElement | null>(null), failed = ref(false)
let revision = 0, animation = 0, lastFrame = 0, artwork: HTMLCanvasElement | undefined
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
function paint(time: number) {
  const ctx = canvas.value?.getContext('2d'), img = artwork
  if (!ctx || !img) return
  ctx.clearRect(0, 0, img.width, img.height)
  if (!props.wag || motionPreference.matches) { ctx.drawImage(img, 0, 0); return }
  // Deform only the tail area with a soft falloff into its root. The face and
  // hooves stay anchored instead of making the entire toy stand in for a tail.
  const cells = 24, unit = img.width / cells
  for (let row = 0; row < cells; row++) for (let col = 0; col < cells; col++) {
    const u = (col + .5) / cells, v = (row + .5) / cells
    const side = Math.max(0, Math.min(1, (u - .70) / .20))
    const height = Math.max(0, 1 - Math.abs(v - .51) / .26)
    const weight = side * side * height * height
    const dx = Math.sin(time / 105) * img.width * .022 * weight
    const dy = Math.cos(time / 105) * img.height * .015 * weight
    ctx.drawImage(img, col * unit, row * unit, unit, unit, col * unit + dx, row * unit + dy, unit + .8, unit + .8)
  }
}
function tick(time: number) { animation = requestAnimationFrame(tick); if (!document.hidden && time - lastFrame > 32) { lastFrame = time; paint(time) } }
function updateMotion() { cancelAnimationFrame(animation); if (props.wag && !motionPreference.matches) animation = requestAnimationFrame(tick); else paint(0) }
async function render() {
  const ticket = ++revision; failed.value = false
  try {
    const image = props.prop ? await buddyProp(props.prop) : await buddySprite(props.skin, props.level)
    if (ticket !== revision || !canvas.value) return
    canvas.value.width = image.width; canvas.value.height = image.height
    artwork = image; paint(performance.now()); updateMotion()
  } catch { if (ticket === revision) failed.value = true }
}
onMounted(() => { motionPreference.addEventListener('change', updateMotion); void render() }); watch(() => [props.skin, props.level, props.prop], render)
watch(() => props.wag, updateMotion)
onUnmounted(() => { revision++; cancelAnimationFrame(animation); motionPreference.removeEventListener('change', updateMotion) })
</script>
<template><span class="buddy-sprite"><canvas ref="canvas" aria-hidden="true"/><span v-if="failed" class="buddy-asset-error" role="alert">物料加载失败<button @click.stop="render">重试</button></span></span></template>
