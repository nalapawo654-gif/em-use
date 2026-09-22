<script setup lang="ts">
import { ref } from 'vue'
import { api, appState as state } from '../bridge'
import { PIRANHA_SKINS, type PiranhaSkin } from '../shared/types'
import PiranhaVisual from './PiranhaVisual.vue'
const error = ref('')
async function choose(skin: PiranhaSkin) { try { await api.settings({ piranhaSkin: skin }); error.value = '' } catch { error.value = '衣装未能保存，请重试。' } }
</script>
<template><div class="piranha-skins"><button v-for="skin in PIRANHA_SKINS" :key="skin.id" :aria-pressed="state.settings.piranhaSkin === skin.id" @click="choose(skin.id)"><PiranhaVisual :percent="100" :skin="skin.id" gentle/><b>{{ skin.label }}</b></button></div><p v-if="error" role="alert">{{ error }}</p></template>
