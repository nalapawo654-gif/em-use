<script setup lang="ts">
import { ref } from 'vue'
import { api, appState as state } from '../bridge'
import { LUCKYCAT_SKINS, type LuckyCatSkin } from '../shared/types'
import LuckyCatVisual from './LuckyCatVisual.vue'
const notice = ref('')
async function choose(luckycatSkin: LuckyCatSkin) { try { await api.settings({ luckycatSkin }); notice.value = '' } catch { notice.value = '衣服暂未保存，请重试。' } }
</script>
<template><div class="luckycat-skins"><button v-for="skin in LUCKYCAT_SKINS" :key="skin.id" :aria-pressed="state.settings.luckycatSkin === skin.id" @click="choose(skin.id)"><span><LuckyCatVisual :percent="100" :skin="skin.id" gentle paused/></span><b>{{ skin.label }}</b><small>{{ skin.hint }}</small></button></div><p v-if="notice" role="status">{{ notice }}</p></template>
