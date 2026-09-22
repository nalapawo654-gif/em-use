<script setup lang="ts">
import PiranhaSprite from './PiranhaSprite.vue'
defineProps<{ time?: string; alert?: boolean; gentle?: boolean }>()
</script>
<template><span class="piranha-calendar-art" :class="{ 'piranha-calendar-alert': alert && !gentle }"><PiranhaSprite :frame="12"/><b aria-hidden="true">{{ time || '今日' }}</b></span></template>
