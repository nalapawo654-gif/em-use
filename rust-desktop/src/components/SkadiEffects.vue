<script setup lang="ts">
import type { SkadiWeapon } from '../shared/types'
import type { SkadiAction } from '../skadi/play'
defineProps<{ weapon: SkadiWeapon; action: SkadiAction; gentle: boolean; paused: boolean }>()
</script>
<template><div class="skadi-effects" :class="[`effect-${weapon}`,`effect-action-${action}`,{gentle,paused}]" aria-hidden="true">
<svg v-if="action==='blade'||action==='summon'" viewBox="0 0 400 400" class="skadi-skill-field">
  <g class="skadi-magic-seal" v-if="action==='summon'||weapon==='staff'"><circle cx="200" cy="220" r="135"/><circle cx="200" cy="220" r="113"/><path d="M200 85 317 288 83 288Z M200 355 83 152 317 152Z"/><g v-for="i in 8" :key="i" :transform="`rotate(${i*45} 200 220)`"><path d="M200 74v-12m-5 6h10"/></g></g>
  <g v-if="weapon==='sword'" class="skadi-sword-arcs"><path d="M54 302Q199 344 349 139Q305 291 98 321"/><path d="M69 283Q163 318 332 174"/></g>
  <g v-if="weapon==='scythe'" class="skadi-crescent"><path d="M295 92A145 145 0 1 0 308 325A120 120 0 1 1 295 92Z"/></g>
  <g v-if="weapon==='twins'" class="skadi-ice"><path d="m85 100 230 230m0-230L85 330"/><path v-for="i in 8" :key="i" :transform="`rotate(${i*45} 200 220)`" d="m200 67 9 28-9 22-9-22Z"/></g>
  <g v-if="weapon==='bow'" class="skadi-arrows"><g v-for="i in 5" :key="i" :style="{'--i':i}" :transform="`translate(${i*22-75} ${i*18-70})`"><path d="M105 286 302 140l-12 32m12-32-35 4M130 268l-18-5m18 5 1 19"/></g></g>
  <g v-if="weapon==='butterfly'" class="skadi-butterflies"><g v-for="i in 7" :key="i" :style="{'--i':i}" :transform="`translate(${200+Math.cos(i)*120} ${210+Math.sin(i)*120})`"><path d="M0 0C-50-57-40 22-3 5C-30 41 0 26 0 5C30 41 30 15 3 5C50 22 50-57 0 0Z"/></g></g>
</svg>
<div v-if="action==='fly'" class="skadi-flight-trails"><i></i><i></i><i></i></div>
<div v-if="action==='dance'" class="skadi-dance-petals"><i v-for="i in 8" :key="i" :style="{'--i':i}"></i></div>
</div></template>
