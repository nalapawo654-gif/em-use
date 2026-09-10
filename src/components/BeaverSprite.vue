<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { beaverBody, beaverPortrait, beaverProp, beaverTree, type BeaverProp } from '../beaver/sprites'
import type { BeaverSkin } from '../shared/types'
const props = withDefaults(defineProps<{ prop?: BeaverProp; skin?: BeaverSkin; level?: number; tree?: boolean; hat?: boolean }>(), { level: 0, skin: 'sunny' })
const canvas = ref<HTMLCanvasElement>(), failed = ref(false)
let revision = 0
async function render() {
  const ticket = ++revision; failed.value = false
  try {
    const img = props.prop ? await beaverProp(props.prop) : props.tree ? await beaverTree(props.level) : props.hat ? await beaverPortrait(props.skin) : await beaverBody(props.level)
    if (ticket !== revision || !canvas.value) return
    canvas.value.width = img.width; canvas.value.height = img.height
    canvas.value.getContext('2d')!.drawImage(img, 0, 0)
  } catch { if (ticket === revision) failed.value = true }
}
onMounted(render); watch(() => [props.prop, props.skin, props.level, props.tree, props.hat], render); onUnmounted(() => revision++)
</script>
<template><span class="beaver-sprite"><canvas ref="canvas" aria-hidden="true"/><span v-if="failed" class="beaver-asset-error" role="alert">素材未加载<button @click.stop="render">重试</button></span></span></template>
