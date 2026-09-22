<script setup lang="ts">
import PotatoSprite from './PotatoSprite.vue'
defineProps<{ time?: string; alert?: boolean; gentle?: boolean }>()
</script>
<template><span class="potato-calendar-art" :class="{ 'potato-calendar-alert': alert && !gentle }"><PotatoSprite atlas="props" :frame="0"/><b aria-hidden="true">{{ time || '今日' }}</b></span></template>
