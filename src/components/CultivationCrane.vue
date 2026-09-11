<script setup lang="ts">
import type { CranePose } from '../cultivation/ambience'
import CultivationProp from './CultivationProp.vue'
defineProps<{ pose:CranePose }>()
</script>
<template>
  <span class="crane-facing" :style="{transform:`rotateY(${pose.facing}deg)`}" aria-hidden="true">
    <span class="crane-rig" :style="{transform:`rotate(${pose.tilt}deg)`}">
      <CultivationProp class="crane-body" :index="1"/>
      <CultivationProp class="crane-wing" :index="1" :style="{transform:`rotate(${pose.wing}deg)`}"/>
    </span>
  </span>
</template>
<style scoped>
.crane-facing,.crane-rig{position:absolute;inset:0;display:block;pointer-events:none;transform-origin:60% 50%}
.crane-rig>.cultivation-prop{position:absolute;inset:0;width:100%;height:100%}
.crane-body{clip-path:polygon(57% 0,100% 0,100% 100%,0 100%,0 61%,48% 61%,62% 40%)}
.crane-wing{clip-path:polygon(0 0,59% 0,66% 41%,50% 65%,0 65%);transform-origin:61% 43%}
</style>
