<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { loadSprites, type SpriteName } from '../aquarium/sprites'
const props = defineProps<{ name: SpriteName }>()
const src = ref('')
async function update() { try { const sprites = await loadSprites(); src.value = sprites[props.name].toDataURL() } catch { src.value = '' } }
onMounted(update); watch(() => props.name, update)
</script>
<template><img v-if="src" :src="src" class="play-sprite" alt="" draggable="false" /></template>
