<script setup lang="ts">
import { useId } from 'vue'
const id = useId()
</script>
<template>
  <g class="hoop-ball-material" stroke-linecap="round">
    <defs>
      <radialGradient :id="`${id}-leather`" cx=".3" cy=".22" r=".85"><stop stop-color="#ffbf6e"/><stop offset=".45" stop-color="#ed8c43"/><stop offset=".8" stop-color="#c45b2b"/><stop offset="1" stop-color="#7a3e28"/></radialGradient>
      <pattern :id="`${id}-pebble`" width="1.8" height="1.8" patternUnits="userSpaceOnUse"><circle cx=".5" cy=".5" r=".22" fill="#71361f" opacity=".28"/><circle cx="1.3" cy="1.3" r=".2" fill="#ffe2a0" opacity=".32"/></pattern>
    </defs>
    <circle r="8" :fill="`url(#${id}-leather)`" stroke="#74432c" stroke-width=".7"/>
    <circle r="7.7" :fill="`url(#${id}-pebble)`"/>
    <path d="M-7.6-1.3Q0 1 7.7 1M-1.2-7.7Q1 0 .9 7.7M-5.5-5.5Q3-.5-5 6M5.5-5.4Q-2 1 5 6" stroke="#673a27" stroke-width=".8" fill="none"/>
    <path d="M-6-4.6q2-2.8 5-2.7" stroke="#ffe2a7" stroke-width="1" fill="none" opacity=".8"/>
    <path d="M3.2 6.3q2.8-1.5 3.5-4" stroke="#914322" stroke-width=".55" fill="none"/>
  </g>
</template>
