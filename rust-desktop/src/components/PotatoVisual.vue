<script setup lang="ts">
import { useAwakenedArt } from '../evolution/useAwakenedArt'
import AwakenedSprite from './AwakenedSprite.vue'
import { vEvolutionMaterial } from '../evolution/material'
import { computed } from 'vue'
import type { PotatoSkin } from '../potato/catalog'
import { potatoFrame, potatoLevel, type PotatoAction } from '../potato/play'
import PotatoSprite from './PotatoSprite.vue'
const props = withDefaults(defineProps<{percent:number|null;skin?:PotatoSkin;action?:PotatoAction;elapsed?:number;steps?:number;gentle?:boolean;paused?:boolean;retryable?:boolean}>(),{skin:'gundam',action:'idle',elapsed:0,steps:0})
const { art: awakened } = useAwakenedArt('potato', () => props.skin)
const frame=computed(()=>potatoFrame(props.percent,props.skin))
const propFrame=computed(()=>({pet:8,coffee:3,calculate:10,shield:4,cheer:5,tease:9,repair:6,idle:-1})[props.action])
</script>
<template><div class="potato-visual" :class="['potato-action-'+action,'potato-level-'+potatoLevel(percent),{'potato-gentle':gentle||paused}]" :data-skin="skin" :data-action="action"><div class="potato-motion evolution-equipped" v-evolution-material="{ scene: 'potato', skin, pose: action, percent, paused }"><AwakenedSprite v-if="awakened" class="evolution-base" :src="awakened.urls[{full:0,worn:1,taped:2,cardboard:3,unknown:1}[potatoLevel(percent)]]!"/><PotatoSprite v-else class="evolution-base" :frame="frame.frame" :atlas="frame.atlas" :retryable="retryable"/><PotatoSprite v-if="propFrame>=0" class="potato-action-prop" atlas="props" :frame="propFrame"/><PotatoSprite v-if="action==='pet'||action==='cheer'" class="potato-reaction" atlas="props" :frame="action==='pet'?9:13"/><span v-if="action==='calculate'" class="potato-calculation">{{ ['开舱算账','1 + 1 = 2','2 + 1 = 3','小账已核对'][steps] }}</span></div></div></template>
