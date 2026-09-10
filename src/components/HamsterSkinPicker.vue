<script setup lang="ts">
import { ref } from 'vue'
import { PhCheck } from '@phosphor-icons/vue'
import { api, appState as state } from '../bridge'
import { HAMSTER_SKINS, type HamsterSkin } from '../shared/types'
import HamsterVisual from './HamsterVisual.vue'
const notice = ref('')
async function select(hamsterSkin: HamsterSkin) { try { await api.settings({ hamsterSkin }); notice.value = '' } catch { notice.value = '装扮暂未保存，请重试' } }
</script>
<template><div class="hamster-skins"><button v-for="skin in HAMSTER_SKINS" :key="skin.id" :aria-pressed="(state.settings.hamsterSkin ?? 'classic') === skin.id" :aria-label="'仓鼠装扮：' + skin.label" @click="select(skin.id)"><div class="hamster-skin-thumbnail"><HamsterVisual level="full" :skin="skin.id" :reduced-motion="true"/></div><b>{{ skin.label }}</b><small>{{ skin.hint }}</small><PhCheck v-if="(state.settings.hamsterSkin ?? 'classic') === skin.id"/></button><p v-if="notice" role="status">{{ notice }}</p></div></template>
