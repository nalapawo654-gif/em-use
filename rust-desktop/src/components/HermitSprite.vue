<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import type { HermitSkin } from '../shared/types'
import manifest from '../hermit/atlas.json'
const props = withDefaults(defineProps<{ skin?: HermitSkin; frame?: number; prop?: boolean }>(), { skin: 'box', frame: 0 })
const loaded = ref(false), failed = ref(false), retry = ref(0)
const spec = computed(() => props.prop ? manifest.props : manifest.normal[props.skin])
const rect = computed(() => spec.value.rects[Math.max(0, Math.min(props.frame, spec.value.rects.length - 1))]!)
const scale = computed(() => Math.min(448 / Math.max(...spec.value.rects.map(r => r[2]!)), 448 / Math.max(...spec.value.rects.map(r => r[3]!))))
const path = computed(() => `./assets/hermit/${spec.value.file}`)
const bounds = computed(() => ({ x: (512 - rect.value[2]! * scale.value) / 2, y: 480 - rect.value[3]! * scale.value, width: rect.value[2]! * scale.value, height: rect.value[3]! * scale.value }))
let revision = 0
function load() { const ticket = ++revision; loaded.value = false; failed.value = false; const img = new Image(); img.onload = () => { if (ticket === revision) loaded.value = true }; img.onerror = () => { if (ticket === revision) failed.value = true }; img.src = path.value }
watch(() => [path.value, retry.value], load)
onMounted(load)
onScopeDispose(() => { revision++ })
</script>
<template><span class="hermit-sprite"><svg v-if="!failed" viewBox="0 0 512 512" aria-hidden="true"><svg v-bind="bounds" :style="{ width: bounds.width + 'px', height: bounds.height + 'px' }" :viewBox="rect.join(' ')" overflow="hidden"><image :href="path" x="0" y="0" :width="spec.size[0]" :height="spec.size[1]"/></svg></svg><span v-if="failed" class="hermit-asset-error" role="status" data-pet-gesture>小窝素材未加载<button @click.stop="retry++">重试</button></span><span v-else-if="!loaded" class="hermit-loading">准备小窝…</span></span></template>
