<script setup lang="ts">
import CultivationProp from './CultivationProp.vue'
defineProps<{ lit:boolean }>()
</script>
<template>
  <span class="incense-rig" :class="{'incense-lit':lit}" aria-hidden="true">
    <CultivationProp class="incense-bronze" :index="2"/>
    <span class="incense-ember"></span>
    <svg class="incense-plume" viewBox="0 0 40 100" fill="none"><path v-for="n in 3" :key="n" d="M12 98 C3 81 36 76 25 57 S12 29 28 3" :style="{'--wisp':n}"/></svg>
  </span>
</template>
<style scoped>
.incense-rig{position:absolute;inset:0;pointer-events:none;--smoke:#899e90}
.incense-bronze{width:100%;height:100%;clip-path:polygon(0 43%,40% 43%,43% 26%,49% 18%,53% 13%,61% 23%,60% 33%,71% 43%,100% 43%,100% 100%,0 100%)}
.incense-ember{position:absolute;left:49%;top:36%;width:8%;height:4%;border-radius:50%;background:#f2c586;box-shadow:0 0 1cqw #e8b65b88;opacity:.45;transition:opacity .6s}
.incense-rig .incense-plume{position:absolute;left:38%;bottom:70%;width:45%;height:100%;overflow:visible;transform-origin:50% 100%;transform:skewX(var(--incense-wind,0deg));transition:transform 1.2s,height .6s,opacity .6s}
.incense-plume path{stroke:var(--smoke);stroke-width:2.2;stroke-linecap:round;stroke-dasharray:34 116;opacity:0;animation:incense-wisp 5.4s linear infinite;animation-delay:calc(var(--wisp)*-1.8s)}
.incense-lit .incense-ember{opacity:1;box-shadow:0 0 1.5cqw #ffc371aa}
.incense-rig.incense-lit .incense-plume{height:130%}
@keyframes incense-wisp{0%{stroke-dashoffset:35;opacity:0}20%{opacity:.7}65%{opacity:.55}100%{stroke-dashoffset:-115;opacity:0}}
</style>
