<script setup lang="ts">
import { useAwakenedArt } from '../evolution/useAwakenedArt'
import AwakenedSprite from './AwakenedSprite.vue'
import { vEvolutionMaterial } from '../evolution/material'
import { computed } from 'vue'
import type { PiranhaSkin } from '../shared/types'
import { piranhaFrame, piranhaLevel, type PiranhaAction } from '../piranha/play'
import PiranhaSprite from './PiranhaSprite.vue'
const props = withDefaults(defineProps<{ percent: number | null; skin?: PiranhaSkin; action?: PiranhaAction; elapsed?: number; gentle?: boolean; paused?: boolean; retryable?: boolean }>(), { skin: 'classic', action: 'idle', elapsed: 0 })
const { art: awakened } = useAwakenedArt('piranha', () => props.skin)
const frame = computed(() => piranhaFrame(props.percent, props.skin, props.action, props.elapsed))
</script>
<template><div class="piranha-visual" :class="['piranha-action-' + action, 'piranha-level-' + piranhaLevel(percent), { 'piranha-gentle': gentle || paused }]" :data-skin="skin" :data-action="action"><div class="piranha-motion evolution-equipped" v-evolution-material="{ scene: 'piranha', skin, pose: action, percent, paused }"><AwakenedSprite v-if="awakened" class="evolution-base" :src="awakened.urls[action==='sleep'?3:action==='feed'?1:action==='tease'?2:action==='pet'||action==='bloom'?0:({full:0,hungry:1,low:2,empty:3,unknown:1}[piranhaLevel(percent)])]!"/><PiranhaSprite v-else class="evolution-base" :frame="frame.frame" :atlas="frame.atlas" :retryable="retryable"/></div><span v-if="action === 'feed' && elapsed < 1900" class="piranha-feed-note"><PiranhaSprite :frame="14"/><b>需求</b></span><span v-if="action === 'tease'" class="piranha-tease-note">这个很简单</span><PiranhaSprite v-if="action === 'bloom' || action === 'pet'" class="piranha-flower-feedback" :frame="15"/></div></template>
