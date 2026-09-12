<script setup lang="ts">
import { ref } from 'vue'
import { api, appState as state } from '../bridge'
import { FEIDUDU_SKINS, type FeiduduSkin } from '../shared/types'
import FeiduduVisual from './FeiduduVisual.vue'
const notice = ref('')
async function choose(feiduduSkin: FeiduduSkin) { try { await api.settings({ feiduduSkin }); notice.value = '' } catch { notice.value = '配色暂未保存，请重试。' } }
</script>
<template><div class="feidudu-skins"><button v-for="skin in FEIDUDU_SKINS" :key="skin.id" :aria-pressed="state.settings.feiduduSkin === skin.id" @click="choose(skin.id)"><span><FeiduduVisual :percent="100" :skin="skin.id" gentle/></span><b>{{ skin.label }}</b><small>{{ skin.hint }}</small></button></div><p v-if="notice" role="status">{{ notice }}</p></template>
