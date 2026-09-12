<script setup lang="ts">
import { ref } from 'vue'
import { api, appState as state } from '../bridge'
import { FOX_SKINS, type FoxSkin } from '../shared/types'
import FoxVisual from './FoxVisual.vue'
const notice = ref('')
async function choose(foxSkin: FoxSkin) { try { await api.settings({ foxSkin }); notice.value = '' } catch { notice.value = '墨色暂未保存，请重试。' } }
</script>
<template><div class="fox-skins"><button v-for="skin in FOX_SKINS" :key="skin.id" :aria-pressed="state.settings.foxSkin === skin.id" @click="choose(skin.id)"><span><FoxVisual :percent="100" :skin="skin.id" gentle paused/></span><b>{{ skin.label }}</b><small>{{ skin.hint }}</small></button></div><p v-if="notice" role="status">{{ notice }}</p></template>
