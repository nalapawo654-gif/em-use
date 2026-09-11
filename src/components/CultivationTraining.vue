<script setup lang="ts">
import { PRACTICES, type Practice } from '../cultivation/training'
import type { CultivationLevel } from '../cultivation/play'
import { computed } from 'vue'
import CultivationMaterial from './CultivationMaterial.vue'
const props=defineProps<{ practice: Practice; level: CultivationLevel; quiet: boolean }>()
const item=computed(()=>PRACTICES.find(p=>p.id===props.practice)!)
</script>
<template><div class="cultivation-training" :class="['practice-'+practice,{'training-quiet':quiet,'training-rest':level==='empty'||level==='unknown'||level==='low'}]" aria-hidden="true"><div class="training-ground-ring"></div><div class="training-path"><CultivationMaterial class="training-artifact" :index="item.prop"/></div><template v-if="practice==='breath'"><div class="training-breath-ring"></div><div class="training-breath-ring second"></div><i class="training-palm left"></i><i class="training-palm right"></i></template><template v-if="practice==='sword'"><div class="training-sword-trail"></div><div class="training-sword-trail second"></div></template><template v-if="practice==='alchemy'"><div class="training-fire"><i></i><i></i><i></i></div><i class="training-pill"></i><i class="training-pill second"></i><div class="training-smoke"></div></template><template v-if="practice==='stargaze'"><CultivationMaterial class="training-scroll" :index="2"/><div class="training-star-orbit"><i v-for="n in 5" :key="n" :style="{transform:`rotate(${n*72}deg) translateX(18cqw)`}">✧</i></div></template><span v-for="n in 8" :key="n" class="training-mote" :style="{'--n':n,animationDelay:`${-n*.6}s`}"></span></div></template>
