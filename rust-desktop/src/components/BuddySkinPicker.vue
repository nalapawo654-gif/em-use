<script setup lang="ts">
import { ref } from 'vue'
import { PhCheck } from '@phosphor-icons/vue'
import { api, appState as state } from '../bridge'
import { BUDDY_SKINS, type BuddySkin } from '../shared/types'
import BuddySprite from './BuddySprite.vue'
const notice = ref('')
async function choose(skin: BuddySkin) { try { await api.settings({ buddySkin: skin }); notice.value = '' } catch { notice.value = '装扮未保存，请重试' } }
</script>
<template><div class="buddy-skins"><button v-for="skin in BUDDY_SKINS" :key="skin.id" :class="['skin-' + skin.id, { selected: state.settings.buddySkin === skin.id }]" :aria-pressed="state.settings.buddySkin === skin.id" @click="choose(skin.id)"><BuddySprite :skin="skin.id"/><b>{{ skin.label }}</b><PhCheck v-if="state.settings.buddySkin === skin.id" class="buddy-skin-check"/></button><p v-if="notice" role="status">{{ notice }}</p></div></template>
