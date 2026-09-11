<script setup lang="ts">
import { ref } from 'vue'
import { PhCheck } from '@phosphor-icons/vue'
import { api, appState as state } from '../bridge'
import { BEAVER_SKINS, type BeaverSkin } from '../shared/types'
import BeaverSprite from './BeaverSprite.vue'
const notice = ref('')
async function choose(skin: BeaverSkin) { try { await api.settings({ beaverSkin: skin }); notice.value = '' } catch { notice.value = '装扮暂未保存，请重试' } }
</script>
<template><div class="beaver-skins"><button v-for="skin in BEAVER_SKINS" :key="skin.id" :aria-label="`海狸鼠${skin.label}装扮`" :aria-pressed="state.settings.beaverSkin === skin.id" :class="{ selected: state.settings.beaverSkin === skin.id }" @click="choose(skin.id)"><BeaverSprite hat :skin="skin.id"/><b>{{ skin.label }}</b><small>{{ skin.hint }}</small><PhCheck v-if="state.settings.beaverSkin === skin.id"/></button></div><p v-if="notice" role="status">{{ notice }}</p></template>
