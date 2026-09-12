<script setup lang="ts">
import { ref } from 'vue'
import { api, appState as state } from '../bridge'
import { DINOSAUR_SKINS, type DinosaurSkin } from '../shared/types'
import DinosaurVisual from './DinosaurVisual.vue'
const notice = ref('')
async function choose(dinosaurSkin: DinosaurSkin) { try { await api.settings({ dinosaurSkin }); notice.value = '' } catch { notice.value = '配色暂未保存，请重试。' } }
</script>
<template><div class="dinosaur-skins"><button v-for="skin in DINOSAUR_SKINS" :key="skin.id" :aria-pressed="state.settings.dinosaurSkin === skin.id" @click="choose(skin.id)"><span><DinosaurVisual :percent="100" :skin="skin.id" gentle/></span><b>{{ skin.label }}</b><small>{{ skin.hint }}</small></button></div><p v-if="notice" role="status">{{ notice }}</p></template>
