<script setup lang="ts">
import { ref } from 'vue'
import { PhFish, PhCow } from '@phosphor-icons/vue'
import { api, appState as state } from '../bridge'
import type { Scene } from '../shared/types'
const notice = ref('')
async function choose(scene: Scene) { try { await api.settings({ scene }); notice.value = '' } catch { notice.value = '场景切换失败，请重试' } }
</script>
<template><div class="scene-picker" aria-label="选择宠物场景"><button :aria-pressed="state.settings.scene === 'aquarium'" :class="{ selected: state.settings.scene === 'aquarium' }" @click="choose('aquarium')"><PhFish weight="duotone"/>额度小鱼缸</button><button :aria-pressed="state.settings.scene === 'buddy'" :class="{ selected: state.settings.scene === 'buddy' }" @click="choose('buddy')"><PhCow weight="duotone"/>充气牛马</button><small v-if="notice" role="status">{{ notice }}</small></div></template>
