<script setup lang="ts">
import type { Encounter } from '../cultivation/encounters'
import CultivationMaterial from './CultivationMaterial.vue'
defineProps<{ event: Encounter }>()
</script>
<template>
  <div v-if="event.kind==='drowsy'" class="story-drowsy">
    <span v-for="n in 3" :key="n" class="story-sleep-mark" :class="'sleep-mark-'+n">z</span>
    <svg class="story-wake" viewBox="0 0 100 100" fill="none"><path d="M34 22 30 15 M57 17 59 8 M76 26 83 21"/></svg>
  </div>
  <template v-else-if="event.kind==='runaway-sword'">
    <svg class="story-sword-trace" viewBox="0 0 100 100" fill="none"><path d="M77 44 C95 24 40 12 34 36 S89 64 80 27 S37 21 45 32"/></svg>
    <div class="story-sword"><CultivationMaterial :index="0"/></div>
    <span class="story-sword-seal">定</span>
  </template>
  <template v-else-if="event.kind==='golden-pill' || event.kind==='furnace-pop'">
    <div class="story-furnace">
      <div class="story-fire"><i></i><i></i><i></i></div>
      <CultivationMaterial class="story-furnace-body" :index="1"/>
      <CultivationMaterial class="story-furnace-lid" :index="1"/>
    </div>
    <template v-if="event.kind==='golden-pill'">
      <div class="story-pill-ray"></div><i class="story-golden-pill"></i>
      <span class="story-pill-spark" v-for="n in 5" :key="n" :style="{'--spark':n}">✧</span>
    </template>
    <template v-else>
      <div class="story-pop-ring"></div>
      <div class="story-smoke-puff" v-for="n in 5" :key="n" :class="'puff-'+n"></div>
      <span class="story-pop-word">噗</span>
    </template>
  </template>
  <template v-else-if="event.kind==='spirit-visit'">
    <svg class="story-visit-herb" viewBox="0 0 100 70" fill="none">
      <path d="M15 57 Q46 37 83 13" stroke="#8e9c58" stroke-width="3"/>
      <path d="M34 45 Q12 42 18 21 Q36 21 39 41 M48 35 Q41 9 58 8 Q66 24 51 33 M59 29 Q75 27 87 40 Q68 48 59 29 M72 20 Q71 3 89 4 Q94 17 72 20" fill="#91ad71" stroke="#597c58" stroke-width="1.8"/>
      <path d="M27 27 34 38 M57 15 50 27 M68 34 80 39" stroke="#c9d9a0" stroke-width="1.2"/>
    </svg>
    <div class="story-visit-affection"><span>♡</span><i></i><i></i></div>
  </template>
  <template v-else-if="event.kind==='crane-letter'">
    <div class="story-paper-crane">
      <svg viewBox="0 0 120 90" fill="none">
        <path class="paper-wing-back" d="M52 55 18 8 69 42 83 56Z" fill="#ddd5b5" stroke="#a89362"/>
        <path d="M26 68 52 43 85 55 111 35 101 59 81 63 66 79Z" fill="#fcf5dc" stroke="#ad9766" stroke-width="1.2"/>
        <path class="paper-wing-front" d="M30 68 8 28 70 51 65 79Z" fill="#fff9e8" stroke="#bca778" stroke-width="1.2"/>
        <path d="M85 55 99 32 111 35 M52 43 66 79 81 63" stroke="#c4ac79"/>
        <path d="M101 36 108 37" stroke="#69583c" stroke-width="1.5"/>
      </svg>
    </div>
    <div class="story-letter"><CultivationMaterial :index="2"/><span class="story-letter-copy">山中无恙<br/>盼君来叙</span></div>
    <span class="story-letter-glint">✧</span>
  </template>
</template>
