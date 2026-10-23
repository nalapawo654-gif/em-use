<script setup lang="ts">
import { api, appState } from '../bridge'
import { BASKETBALL_SKINS } from '../shared/types'
import BasketballPlayer from './BasketballPlayer.vue'
import { ref } from 'vue'
const error = ref('')
async function select(skin: typeof BASKETBALL_SKINS[number]['id']) { try { await api.settings({ basketballSkin: skin }); error.value = '' } catch { error.value = '球衣未能保存，请重试。' } }
</script>
<template><div class="hoop-wardrobe"><button v-for="skin in BASKETBALL_SKINS" :key="skin.id" :aria-pressed="appState.settings.basketballSkin === skin.id" @click="select(skin.id)"><BasketballPlayer :skin="skin.id" gentle/><b>{{ skin.label }}</b><small>{{ skin.hint }}</small></button></div><p v-if="error" role="alert">{{ error }}</p></template>
