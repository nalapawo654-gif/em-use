<script setup lang="ts">
import { ref, watch } from 'vue'
import { loadPiranhaAtlas, piranhaRetryVersion } from '../piranha/sprites'
const props = withDefaults(defineProps<{ frame: number; atlas?: 'character' | 'costume'; retryable?: boolean }>(), { atlas: 'character' })
const canvas = ref<HTMLCanvasElement>(), ready = ref(false), failed = ref(false)
// Explicit source boundaries preserve the generated alpha and avoid the atlas's uneven gutters.
const columns = [0, 316, 632, 946, 1254]
const rows = { character: [0, 347, 650, 977, 1254], costume: [0, 328, 625, 937, 1254] }
watch(() => [props.atlas, props.frame, piranhaRetryVersion.value, canvas.value], async (_, __, cleanup) => {
  let cancelled = false; cleanup(() => { cancelled = true }); ready.value = false; failed.value = false
  if (!canvas.value) return
  try {
    const source = await loadPiranhaAtlas(props.atlas)
    if (cancelled || !canvas.value) return
    const col = props.frame % 4, row = Math.floor(props.frame / 4), ys = rows[props.atlas]
    const sx = columns[col], sy = ys[row], sw = columns[col + 1] - sx, sh = ys[row + 1] - sy
    const scale = Math.min(512 / sw, 512 / sh), width = sw * scale, height = sh * scale
    const context = canvas.value.getContext('2d')!
    canvas.value.width = 512; canvas.value.height = 512
    context.drawImage(source, sx, sy, sw, sh, (512 - width) / 2, 512 - height, width, height)
    ready.value = true
  } catch { if (!cancelled) failed.value = true }
}, { immediate: true, flush: 'post' })
</script>
<template><span class="piranha-sprite" :data-ready="ready" :data-frame="frame" :data-atlas="atlas"><canvas ref="canvas" aria-hidden="true"/><span v-if="failed" class="piranha-asset-error" role="status">{{ retryable ? '小花素材未加载' : '素材未加载' }}<button v-if="retryable" @click.stop="piranhaRetryVersion++">重试</button></span></span></template>
