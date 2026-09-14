<script setup lang="ts">
import BeaverSprite from './BeaverSprite.vue'
import BeaverActor from './BeaverActor.vue'
import { beaverAppearance } from '../beaver/appearance'
import type { BeaverAction } from '../beaver/play'
import type { BeaverSkin } from '../shared/types'
defineProps<{message?:boolean;level:number;skin:BeaverSkin;action:BeaverAction;since:number;reducedMotion:boolean}>()
</script>
<template>
  <div class="beaver-visual" :class="'beaver-level-'+level" :data-expression="beaverAppearance(level).expression" :data-tree-state="beaverAppearance(level).tree">
    <BeaverSprite tree :level="level" class="beaver-tree"/>
    <div class="beaver-actor-art"><BeaverActor :message="message" :level="level" :skin="skin" :action="action" :since="since" :reduced-motion="reducedMotion"/></div>
  </div>
</template>
