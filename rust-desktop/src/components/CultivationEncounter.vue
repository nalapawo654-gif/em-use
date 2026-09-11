<script setup lang="ts">
import { encounterCaption, encounterPhase, encounterDefinition, type Encounter } from '../cultivation/training'
import CultivationVignette from './CultivationVignette.vue'
import CultivationMaterial from './CultivationMaterial.vue'
defineProps<{ event: Encounter; quiet: boolean }>()
defineEmits<{dismiss:[]}>()
</script>
<template>
  <div class="cultivation-encounter" :class="['encounter-'+event.kind,'phase-'+encounterPhase(event),{'encounter-quiet':quiet}]" aria-hidden="true">
    <div v-if="event.kind==='tribulation'||event.kind==='enlightenment'" class="encounter-radiance"></div>
    <template v-if="event.kind==='tribulation'">
      <div class="encounter-cloud"><i></i><i></i><i></i></div>
      <svg class="encounter-lightning" viewBox="0 0 100 100" fill="none">
        <g v-for="(path,i) in ['M49 13 42 24 52 22 44 37 55 34 56 46','M74 16 67 29 76 26 65 44 71 43','M31 16 38 28 29 27 39 43']" :key="path" :style="{'--bolt':i}"><path :d="path" class="bolt-glow"/><path :d="path" class="bolt-core"/></g>
      </svg>
      <div class="encounter-shield"></div><div class="encounter-impact"></div>
      <span class="encounter-sigil">敕</span>
    </template>
    <template v-else-if="event.kind==='enlightenment'">
      <div class="encounter-beam"></div><div class="encounter-halo"></div>
      <CultivationMaterial class="encounter-lotus" :index="11"/>
      <span v-for="(rune,i) in ['道','法','自','然']" :key="rune" class="encounter-rune" :style="{'--rune':i}">{{rune}}</span>
      <i v-for="n in 9" :key="n" class="encounter-petal" :style="{'--petal':n}"></i>
    </template>
    <CultivationVignette v-else :event="event"/>
    <div v-if="event.kind==='tribulation'||event.kind==='enlightenment'" class="encounter-ground"></div>
  </div>
  <div class="cultivation-encounter-caption"><span role="status"><span class="encounter-caption-full">{{encounterCaption(event)}}</span><span class="encounter-caption-compact">{{encounterDefinition(event.kind).label}} · {{encounterPhase(event)==='gather'?'将至':encounterPhase(event)==='settle'?'收势':'进行中'}}</span></span><button aria-label="结束当前修炼奇遇" @click="$emit('dismiss')">收心</button></div>
</template>
