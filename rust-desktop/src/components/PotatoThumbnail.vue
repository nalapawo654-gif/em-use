<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { evolution } from '../evolution/controller'
import { potatoFrame } from '../potato/play'
import { loadPotatoThumbnail } from '../potato/thumbnails'
import type { PotatoSkin } from '../potato/catalog'
import PotatoSprite from './PotatoSprite.vue'
const props = defineProps<{ skin: PotatoSkin }>()
const canvas = ref<HTMLCanvasElement>(), ready = ref(false), failed = ref(false)
const base = computed(() => potatoFrame(100, props.skin))
watch(() => [props.skin, evolution.awake, canvas.value], async (_, __, cleanup) => {
  let cancelled = false; cleanup(() => { cancelled = true }); ready.value = false; failed.value = false
  if (!evolution.awake || !canvas.value) return
  const ctx = canvas.value.getContext('2d')!; ctx.clearRect(0, 0, 256, 256)
  try {
    const art = await loadPotatoThumbnail(props.skin)
    if (cancelled) return
    ctx.drawImage(art, 0, 0); ready.value = true
  } catch { if (!cancelled) failed.value = true }
}, { flush: 'post', immediate: true })
</script>
<template><span class="potato-visual potato-thumbnail" :data-skin="skin" :data-ready="ready"><canvas v-if="evolution.awake" ref="canvas" width="256" height="256" aria-hidden="true"/><PotatoSprite v-else :atlas="base.atlas" :frame="base.frame"/><span v-if="failed" role="status">素材未加载</span></span></template>
<style scoped>
.potato-thumbnail{display:block;position:relative;pointer-events:none}
.potato-thumbnail>canvas{display:block;width:100%;height:100%;object-fit:contain}
</style>
