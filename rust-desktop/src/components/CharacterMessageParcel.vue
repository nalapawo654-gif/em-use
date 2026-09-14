<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { loadImage } from '../aquarium/sprites'
import type { Scene } from '../shared/types'
const props = defineProps<{ scene: Scene }>()
const canvas = ref<HTMLCanvasElement>(), ready = ref(false), failed = ref(false)
// Magenta keeps the leaves and mint phone intact. Decode the independent prop
// once per mount; actor animation, costumes and quota never transform this layer.
onMounted(async () => {
  try {
    const source = await loadImage(`./assets/${props.scene}/message-prop.png`)
    const target = canvas.value
    if (!target) return
    target.width = source.naturalWidth; target.height = source.naturalHeight
    const ctx = target.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(source, 0, 0)
    const frame = ctx.getImageData(0, 0, target.width, target.height), d = frame.data
    for (let i = 0; i < d.length; i += 4) {
      const matte = Math.max(0, Math.min(1, (Math.min(d[i], d[i + 2]) - d[i + 1] - 25) / 85))
      d[i + 3] = Math.round(d[i + 3] * (1 - matte))
      if (matte > 0 && matte < 1) {
        d[i] -= Math.round((d[i] - d[i + 1]) * matte)
        d[i + 2] -= Math.round((d[i + 2] - d[i + 1]) * matte)
      }
    }
    ctx.putImageData(frame, 0, 0); ready.value = true
  } catch { failed.value = true }
})
</script>
<template>
  <canvas ref="canvas" class="character-mail-art message-prop-motion" :data-ready="ready" aria-hidden="true"/>
  <span v-if="failed" class="character-mail-fallback" role="img" aria-label="消息物料加载失败，仍可点击查看消息">信</span>
</template>
