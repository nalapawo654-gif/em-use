<script setup lang="ts">
import { computed } from 'vue'
import type { PiranhaSkin } from '../shared/types'
import { piranhaFrame, piranhaLevel, type PiranhaAction } from '../piranha/play'
import PiranhaSprite from './PiranhaSprite.vue'
const props = withDefaults(defineProps<{ percent: number | null; skin?: PiranhaSkin; action?: PiranhaAction; elapsed?: number; gentle?: boolean; paused?: boolean; retryable?: boolean }>(), { skin: 'classic', action: 'idle', elapsed: 0 })
const frame = computed(() => piranhaFrame(props.percent, props.skin, props.action, props.elapsed))
</script>
<template><div class="piranha-visual" :class="['piranha-action-' + action, 'piranha-level-' + piranhaLevel(percent), { 'piranha-gentle': gentle || paused }]" :data-skin="skin" :data-action="action"><div class="piranha-motion"><PiranhaSprite :frame="frame.frame" :atlas="frame.atlas" :retryable="retryable"/></div><span v-if="action === 'feed' && elapsed < 1900" class="piranha-feed-note"><PiranhaSprite :frame="14"/><b>需求</b></span><span v-if="action === 'tease'" class="piranha-tease-note">这个很简单</span><PiranhaSprite v-if="action === 'bloom' || action === 'pet'" class="piranha-flower-feedback" :frame="15"/></div></template>
