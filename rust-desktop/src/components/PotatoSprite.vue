<script setup lang="ts">
import { ref, watch } from 'vue'
import crops from '../potato/crops.json'
import type { PotatoAtlas } from '../potato/catalog'
import { loadPotatoAtlas, potatoRetryVersion } from '../potato/sprites'
const props = withDefaults(defineProps<{ frame: number; atlas?: PotatoAtlas; retryable?: boolean }>(), { atlas: 'armor-1' })
const canvas = ref<HTMLCanvasElement>(), ready = ref(false), failed = ref(false)
watch(() => [props.atlas, props.frame, potatoRetryVersion.value, canvas.value], async (_, __, cleanup) => {
  let cancelled = false; cleanup(() => { cancelled = true }); ready.value = false; failed.value = false
  if (!canvas.value) return
  try {
    const isFlag = props.atlas === 'props' && props.frame === 5
    const source = await loadPotatoAtlas(isFlag ? 'china-flag' : props.atlas)
    if (cancelled || !canvas.value) return
    const col = props.frame % 4, row = Math.floor(props.frame / 4)
    // Authored cell boundaries preserve whole silhouettes in the generated uneven gutters.
    const bounds = isFlag ? [0, 0, source.width, source.height] : (crops as Record<string, number[][]>)[props.atlas]?.[props.frame]
    const [sx, sy, sw, sh] = bounds ?? [col * source.width / 4, row * source.height / 4, source.width / 4, source.height / 4]
    const scale = Math.min(512 / sw, 512 / sh), width = sw * scale, height = sh * scale
    const context = canvas.value.getContext('2d')!
    canvas.value.width = 512; canvas.value.height = 512
    context.drawImage(source, sx, sy, sw, sh, (512 - width) / 2, 512 - height, width, height)
    ready.value = true
  } catch { if (!cancelled) failed.value = true }
}, { immediate: true, flush: 'post' })
</script>
<template><span class="potato-sprite" :data-ready="ready" :data-frame="frame" :data-atlas="atlas"><canvas ref="canvas" aria-hidden="true"/><span v-if="failed" class="potato-asset-error" role="status">{{ retryable ? '机甲素材未加载' : '素材未加载' }}<button v-if="retryable" @click.stop="potatoRetryVersion++">重试</button></span></span></template>
