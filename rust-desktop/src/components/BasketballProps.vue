<script setup lang="ts">
import { useId } from 'vue'
defineProps<{ kind: 'locker' | 'delivery' }>()
const id = useId()
const paint = (name: string) => `url(#${id}-${name})`
</script>
<template>
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">
    <defs>
      <linearGradient :id="`${id}-enamel`" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5bc7d"/><stop offset=".48" stop-color="#d9824a"/><stop offset="1" stop-color="#b35b38"/></linearGradient>
      <linearGradient :id="`${id}-paper`" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f7e7c8"/><stop offset="1" stop-color="#c9bda4"/></linearGradient>
      <linearGradient :id="`${id}-shoe`" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#fff7e2"/><stop offset=".6" stop-color="#e5ddc9"/><stop offset="1" stop-color="#a7b4ae"/></linearGradient>
    </defs>
    <g v-if="kind === 'locker'" stroke="#714b38" stroke-width=".8">
      <ellipse cx="40" cy="75" rx="26" ry="3" fill="#213e4b" stroke="none" opacity=".14"/>
      <path d="M19 69v6h5v-6m33-1v7h5v-7" fill="#314955"/>
      <path d="m17 8 8-4 40 3v64l-8 3-40-3Z" fill="#975436"/>
      <path d="m17 8 40 3v63l-40-3Z" :fill="paint('enamel')"/>
      <path d="m17 8 8-4 40 3-8 4Z" fill="#f0ba83"/>
      <path d="m21 12 32 2v54l-32-2Z" :fill="paint('enamel')" stroke="#985335"/>
      <path d="m23 14 28 2m-29-1v49" stroke="#ffe2b3" stroke-width=".7" opacity=".65"/>
      <path d="m28 20 18 1m-18 3 18 1m-18 3 18 1m-18 28 18 1m-18 3 18 1" stroke="#915336" stroke-width="1.5"/>
      <path d="m28 19.5 18 1m-18 3 18 1m-18 3 18 1" stroke="#f8cea0" stroke-width=".55"/>
      <path d="m30 33 14 1v11l-14-1Z" fill="#f7e8cb" stroke="#bd865b"/>
      <text x="37" y="42" fill="#47616c" stroke="none" font-size="8" font-weight="800" text-anchor="middle" font-family="Arial,sans-serif">23</text>
      <rect x="47" y="39" width="3" height="9" rx="1.4" fill="#e3e1cb" stroke="#765640"/>
      <circle cx="48.5" cy="50" r="1" fill="#354c56" stroke="none"/>
      <path d="m57 12 0 59m5-61v58" stroke="#f8c591" stroke-opacity=".3"/>
      <path d="m18 23 3 .2m-3 33 3 .2" stroke="#f3e3c4" stroke-width="2"/>
    </g>
    <g v-else class="parcel-move" stroke="#624a3b" stroke-width=".85">
      <ellipse cx="40" cy="73" rx="32" ry="3.2" fill="#213e4b" stroke="none" opacity=".15"/>
      <path d="m10 44 47 3 14-8v27l-14 8-47-3Z" :fill="paint('enamel')"/>
      <path d="m57 47 14-8v27l-14 8Z" fill="#ad5b3b"/>
      <path d="m8 39 47 3 18-7v9l-18 8-47-4Z" fill="#dfb787"/>
      <path d="m8 39 17-7 48 3-18 8Z" :fill="paint('paper')"/>
      <path d="m9 45 46 4 16-7" stroke="#ffe6ba" stroke-width=".8"/>
      <path d="m16 53 15 1v10l-15-1Z" fill="#f3e5c8" stroke="#b78253"/>
      <path d="m18 57 10 1m-10 2 7 .5" stroke="#997b5d" stroke-width=".6"/>
      <path d="m62 54 5-2" stroke="#633e30" stroke-width="2.5"/>
      <circle cx="43" cy="60" r="5" fill="#35525f" stroke="#294550"/>
      <path d="m40 59 3 3 3-3" stroke="#f8eacb" stroke-width="1.2"/>
      <path d="m23 16 13-1 5 12 17 5c7 2 9 5 8 9-14 4-35 3-49 0-2-4-1-8 2-12Z" :fill="paint('shoe')" stroke="#3b535b"/>
      <path d="m23 16 13-1 4 10-12 5-8-2Z" fill="#dc8a54"/>
      <path d="m26 19 8-1 3 6-9 3Z" fill="#355766"/>
      <path d="m31 28 10-1m-8 4 12-1m-9 4 12-1" stroke="#fcf4df" stroke-width="2"/>
      <path d="M18 37q20 5 47 1v3q-22 5-48 0Z" fill="#fff3d9"/>
      <path d="m43 33 6 4 9-1" stroke="#d9844f" stroke-width="2.4"/>
      <path d="m20 40 8 1m27 0 7-1" stroke="#446270" stroke-width=".8"/>
    </g>
  </svg>
</template>
