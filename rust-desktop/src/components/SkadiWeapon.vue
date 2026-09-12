<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { SKADI_WEAPONS, type SkadiWeapon } from '../shared/types'
import { loadSkadiWeapons } from '../skadi/sprites'
import { SKADI_WEAPON_INDEX } from '../skadi/motion'
const props = withDefaults(defineProps<{ weapon?: SkadiWeapon; power?: 'rest' | 'cast' | 'attack'; gentle?: boolean; paused?: boolean; thumbnail?: boolean }>(), { weapon: 'sword', power: 'rest', gentle: false, paused: false, thumbnail: false })
const frames = ref<string[]>([]), error = ref(false)
const spec = computed(() => SKADI_WEAPONS.find(w => w.id === props.weapon)!)
let disposed = false
onMounted(async () => { try { const result = await loadSkadiWeapons(); if (!disposed) frames.value = result } catch { if (!disposed) error.value = true } })
onUnmounted(() => { disposed = true })
</script>
<template><div class="skadi-weapon" :class="[`weapon-${weapon}`,`power-${power}`,{gentle,paused,thumbnail}]" :data-weapon="weapon" :data-power="power" :data-loaded="!!frames.length" :style="{'--weapon-color':spec.color}" aria-hidden="true"><span class="skadi-weapon-aura"></span><img v-if="frames.length" :src="frames[SKADI_WEAPON_INDEX[weapon]]" alt="" draggable="false"/><small v-else class="skadi-weapon-load">{{error?'武器加载失败':'星辉汇聚中…'}}</small><span v-if="!thumbnail" class="skadi-weapon-sparks"><i v-for="i in 4" :key="i" :style="{'--i':i}">✦</i></span></div></template>
