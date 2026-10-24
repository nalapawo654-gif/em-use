<script setup lang="ts">
import { computed } from 'vue'
import type { HermitSkin, HermitAccessory } from '../shared/types'
import { useAwakenedArt } from '../evolution/useAwakenedArt'
import { vEvolutionMaterial } from '../evolution/material'
import { evolution, evolutionMotion, systemReduced } from '../evolution/controller'
import { hermitFrame, hermitIdle, type HermitPlay } from '../hermit/play'
import { HERMIT_ACCESSORIES } from '../hermit/catalog'
import HermitSprite from './HermitSprite.vue'
import AwakenedSprite from './AwakenedSprite.vue'
const props = withDefaults(defineProps<{ percent: number | null; skin?: HermitSkin; accessory?: HermitAccessory; play?: HermitPlay; now?: number; gentle?: boolean; paused?: boolean; interactiveAccessory?: boolean }>(), { skin: 'box', accessory: 'none', now: 0 })
const emit = defineEmits<{ accessory: [] }>()
const play = computed(() => props.play ?? hermitIdle())
const frame = computed(() => hermitFrame(props.percent, play.value, props.now))
const { art, cinematic } = useAwakenedArt('hermit', () => props.skin, () => 'chibi', () => frame.value)
const accessory = computed(() => HERMIT_ACCESSORIES.find(item => item.id === props.accessory)?.frame)
const still = computed(() => props.gentle || props.paused || systemReduced.value || evolutionMotion.value !== 'full')
</script>
<template><div class="hermit-visual" :class="['hermit-action-' + play.action, 'hermit-skin-' + skin, { 'hermit-still': still, 'hermit-cinematic': cinematic }]" :data-skin="skin" :data-frame="frame" :data-awake="!!art"><div class="hermit-motion" v-evolution-material="{ scene: 'hermit', skin, pose: play.action, percent, paused, cinematic }"><AwakenedSprite v-if="art" class="hermit-base" :src="art.urls[frame]!"/><HermitSprite v-else class="hermit-base" :skin="skin" :frame="frame"/><component :is="interactiveAccessory ? 'button' : 'span'" v-if="accessory != null && !cinematic" class="hermit-accessory" :class="['accessory-' + accessory, { 'accessory-awake': evolution.awake }]" :aria-label="interactiveAccessory ? '整理寄居蟹的随身装饰' : undefined" @click.stop="emit('accessory')"><HermitSprite prop :frame="accessory"/></component><HermitSprite v-if="play.action === 'tidy' && skin === 'box'" class="hermit-tape" prop :frame="7"/></div></div></template>
