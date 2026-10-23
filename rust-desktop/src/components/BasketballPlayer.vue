<script setup lang="ts">
import { useId } from 'vue'
withDefaults(defineProps<{ skin?: string; pose?: string; gentle?: boolean; awake?: boolean }>(), { skin: 'home', pose: 'idle' })
// The court, wardrobe and settings thumbnails can be mounted together.
const id = useId()
const paint = (name: string) => `url(#${id}-${name})`
</script>
<template>
  <svg viewBox="0 0 110 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" :class="['hoop-player', 'jersey-' + skin, 'pose-' + pose, { 'player-gentle': gentle, 'player-awake': awake }]">
    <defs>
      <radialGradient :id="`${id}-skin`" cx=".32" cy=".26" r=".8"><stop stop-color="#fff4db"/><stop offset=".55" stop-color="#f8d7ae"/><stop offset="1" stop-color="#d99775"/></radialGradient>
      <linearGradient :id="`${id}-limb`" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#ffe9c9"/><stop offset=".5" stop-color="#f5cca3"/><stop offset="1" stop-color="#d79a79"/></linearGradient>
      <linearGradient :id="`${id}-hair`" x1=".2" y1="0" x2=".8" y2="1"><stop stop-color="#53616a"/><stop offset=".45" stop-color="#2c3943"/><stop offset="1" stop-color="#182a34"/></linearGradient>
      <linearGradient :id="`${id}-kit`" x1="0" y1=".15" x2="1" y2=".75"><stop class="player-kit-light"/><stop offset=".42" class="player-kit-main"/><stop offset="1" class="player-kit-shade"/></linearGradient>
      <linearGradient :id="`${id}-band`" x1="0" y1="0" x2=".4" y2="1"><stop class="player-band-light"/><stop offset="1" class="player-band-shade"/></linearGradient>
      <linearGradient :id="`${id}-shorts`" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#445968"/><stop offset="1" stop-color="#1d303d"/></linearGradient>
      <linearGradient :id="`${id}-shoe`" x1=".3" y1="0" x2=".6" y2="1"><stop stop-color="#fffef0"/><stop offset=".6" stop-color="#eae5d6"/><stop offset="1" stop-color="#a9b6b4"/></linearGradient>
      <linearGradient :id="`${id}-gold`" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1b2"/><stop offset=".5" stop-color="#e9bf66"/><stop offset="1" stop-color="#aa7632"/></linearGradient>
      <radialGradient :id="`${id}-cheek`"><stop stop-color="#e99078" stop-opacity=".65"/><stop offset="1" stop-color="#e99078" stop-opacity="0"/></radialGradient>
      <radialGradient :id="`${id}-shadow`"><stop stop-color="#182f3a" stop-opacity=".23"/><stop offset="1" stop-color="#182f3a" stop-opacity="0"/></radialGradient>
      <pattern :id="`${id}-mesh`" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M1 1v.5" stroke="#fff7df" stroke-opacity=".26" stroke-width=".55" stroke-linecap="round"/></pattern>
      <pattern :id="`${id}-knit`" width="2.4" height="3" patternUnits="userSpaceOnUse"><path d="m.3 .5.8 1 .8-1" stroke="#fff8e4" stroke-opacity=".2" stroke-width=".45" fill="none"/></pattern>
    </defs>
    <ellipse cx="51" cy="134" rx="43" ry="5.5" :fill="paint('shadow')"/>
    <g class="player-figure" stroke-linecap="round" stroke-linejoin="round">
      <!-- Soft vinyl legs, ribbed socks and layered court shoes. -->
      <path d="m30 109-1 14q7 5 14 0l4-14m11 0 3 14q7 4 14-1l-4-15" :fill="paint('limb')" stroke="#b98569" stroke-width=".7"/>
      <path d="m30 117-1 8 13 1 2-9m16-1 1 9 14-1-2-9" fill="#f6efdd" stroke="#b7b6a3" stroke-width=".6"/>
      <path d="m30 119 13 1m18-2 12-1" stroke="var(--jersey)" stroke-width="1.7"/>
      <path d="m32 121-.2 3m3-3-.2 3m3-3-.2 3m26-3 .2 3m3-3 .2 3m3-4 .2 3" stroke="#c4c4b2" stroke-width=".55"/>
      <g stroke="#3d5059" stroke-width=".9">
        <path d="M29 123c-4 .4-7 2.5-10 3.6-4 1.5-6 3.6-5 6.6 7 2 22 2 32 .3l-.6-9.8-6.9-3.5-3.3 4Z" :fill="paint('shoe')"/>
        <path d="m61 123-.8 10.3c9.6 1.8 26 1.7 33.8-.1.8-3.4-2.3-5.6-6-6.7l-10-4-6.3-2.1-3 4.2Z" :fill="paint('shoe')"/>
        <path d="M14 131.2q14 2.2 32 .1v2.4q-17 2.4-32-.2Zm47-.1q16 2 33 0v2.3q-16 2.4-33 0Z" fill="#faf6e7"/>
        <path d="M33 123.7 29 128l15 1v-5l-5.4-2.8-2.6 4m32-2.5 3.8 5.8 14-1.8-8.8-3.9-5.6-2" fill="var(--jersey)" stroke="var(--jersey-dark)"/>
      </g>
      <path d="m28 125 6 1m-8 1 6 1m42-3 5-1m-3 3 5-1" stroke="#fffcf0" stroke-width="1.2"/>
      <path d="m19 129 4-1m59 .8 5 1" stroke="#a7b5b4" stroke-width=".7"/>
      <path d="M18 133.3h7m55 0h10" stroke="var(--jersey-dark)" stroke-width="1.3"/>
      <path d="M29 98c-2 5-5 10-5 16l22 4 5-9 6 9 22-4-6-19Z" :fill="paint('shorts')" stroke="#233946" stroke-width=".9"/>
      <path d="m29 101-1 11 16 3m28-14 3 10-16 4" stroke="var(--jersey-light)" stroke-width="2"/>
      <path d="m31 103-1 7 12 3m27-10 2 7-10 3" stroke="#f3e9c8" stroke-width=".7"/>
      <path d="m51 100 0 8m-4-3-4 5m13-6 5 6" stroke="#101f2a" stroke-opacity=".4" stroke-width=".8"/>
      <g class="player-back-arm">
        <path d="M29 72C19 73 10 81 11 89c.5 6 4.5 10 8 8 5-2 5-7 9-10l9-7Z" :fill="paint('limb')" stroke="#b98669" stroke-width=".85"/>
        <path d="M16 80q-4 5-2 9" stroke="#fff3d4" stroke-width="2" opacity=".7"/>
        <path d="m14 86 9 5-2 4-9-5Z" :fill="paint('shoe')" stroke="#b1b5a8" stroke-width=".6"/>
        <path d="m15 88 6 4" stroke="var(--jersey)" stroke-width="1"/>
        <path d="m16 95 3-1m0-2 2-1" stroke="#bd896d" stroke-width=".7"/>
      </g>
      <!-- Repeat the silhouette for a mesh overlay without a filter or raster texture. -->
      <path d="M33 63q18-5 32 0c10 10 14 23 12 40q-25 9-51 0c-2-20 0-30 7-40Z" class="player-jersey" :fill="paint('kit')" stroke="var(--jersey-dark)" stroke-width=".85"/>
      <path d="M33 63q18-5 32 0c10 10 14 23 12 40q-25 9-51 0c-2-20 0-30 7-40Z" :fill="paint('mesh')"/>
      <path d="M33 66q-5 13-4 33m37-32q10 14 8 32" stroke="var(--jersey-light)" stroke-width="1.3" opacity=".65"/>
      <path d="m31 80-2 17 6 4m37-18 3 15-7 4" fill="var(--jersey-dark)" opacity=".27"/>
      <path d="M37 64q14 14 25 0" stroke="var(--jersey-dark)" stroke-width="5"/>
      <path d="M37 63q14 14 25 0M32 66q-4 7-4 13m39-13q6 6 7 14" stroke="#fdf1d2" stroke-width="2.5"/>
      <path d="M28 99q24 8 47 0" stroke="#f9eccc" stroke-width="2.2"/>
      <path d="M29 102q23 7 45 0" stroke="var(--jersey-dark)" stroke-opacity=".5" stroke-width=".6" stroke-dasharray="1 1.4"/>
      <path d="m35 74 4 .8m-2-2v4" stroke="#fff4d5" stroke-width="1.1"/>
      <rect x="64" y="73" width="4" height="5" rx=".7" fill="#f9eacb" opacity=".9"/><path d="m66 74 0 2.5" stroke="var(--jersey-dark)" stroke-width=".65"/>
      <text x="51" y="80" text-anchor="middle" fill="#fff1d1" font-size="3.9" font-weight="700" font-family="Arial,sans-serif" letter-spacing=".9">HOOPS</text>
      <g v-if="!awake" fill="#fff1d1" stroke="var(--jersey-dark)" stroke-width=".45">
        <path d="M39 83h9v6l-6 4h6v3H37v-5l7-4v-1h-5Z"/><path d="M52 83h10v13H51v-3h7v-2h-5v-3h5v-2h-6Z"/>
      </g>
      <g v-else><path d="m51 82 3.2 5.3 6 .9-4.2 4.4.7 6.1-5.7-2.8-5.7 2.8.7-6.1-4.2-4.4 6-.9Z" :fill="paint('gold')" stroke="#9d7135" stroke-width=".6"/><path d="m51 84 1.9 5 5 .1-4 3 1.5 4-4.4-2" stroke="#fff1b1" stroke-width=".7"/><path d="m36 87-1 5 3 3m28-8 1 5-3 3" stroke="#e9c77b" stroke-width=".9"/></g>
      <rect x="31" y="97" width="5" height="2.7" rx=".4" fill="#f7e7c6"/><path d="M32 98.4h3" stroke="#6f7668" stroke-width=".5"/>
      <g class="player-head">
        <ellipse cx="18.5" cy="43" rx="7" ry="10" :fill="paint('limb')" stroke="#bd8e73" stroke-width=".7"/><ellipse cx="83" cy="43" rx="6.5" ry="9" :fill="paint('limb')" stroke="#bd8e73" stroke-width=".7"/>
        <path d="M18 39q-4 0-2 7m68-7q3 0 1 6" stroke="#c58d74" stroke-width="1.4"/>
        <path d="M18 36C17 13 31 6 51 6S85 15 85 37c3 23-9 36-33 36S15 61 18 36Z" :fill="paint('skin')" stroke="#bd9379" stroke-width=".8"/>
        <path d="M24 40q-4 18 9 25" stroke="#fff2d6" stroke-width="2.4" opacity=".55"/><path d="M36 67q17 7 32-2" stroke="#bc826d" stroke-width="1" opacity=".3"/>
        <ellipse cx="30" cy="55" rx="9" ry="6.4" :fill="paint('cheek')"/><ellipse cx="73" cy="55" rx="8" ry="6.2" :fill="paint('cheek')"/>
        <path d="M18 34c-3-9-2-18 5-23 1-4 7-5 11-5 5-6 12-3 16-3 7-4 15-1 18 3 10 0 17 9 18 19l-3 12-4-9-55 1-4 10Z" :fill="paint('hair')" stroke="#253742" stroke-width=".8"/>
        <path d="M24 17q3-7 12-8m-3 6q6-8 14-7m-2 7q7-9 15-6m-2 5q9-4 15 4" stroke="#829090" stroke-width="1.4" opacity=".35"/><path d="M24 20q6-3 12-1m5-2 6-1m20 5 8 2" stroke="#111f2b" stroke-width="1.4" opacity=".35"/>
        <g class="player-headband">
        <path d="M18 25q32-9 66 1l.3 11.3q-33-8-66.8.2Z" :fill="paint('band')" stroke="var(--headband-dark)" stroke-width=".8"/>
        <path d="M18 25q32-9 66 1l.3 11.3q-33-8-66.8.2Z" :fill="paint('knit')"/>
        <path d="M19 27q31-8 63 1M19 34q32-7 63 1" stroke="#f9edce" stroke-width="1" opacity=".85"/>
        <g :transform="awake ? 'translate(0 -1)' : ''"><path d="m51 25 5 4-5 4-5-4Z" :fill="awake ? paint('gold') : '#f4e6c6'"/><path d="m49 29h4" stroke="var(--headband-dark)" stroke-width=".7"/></g>
        </g>
        <path d="M32 41q4-2 8-.8m23 .6q4-2 8 .4" stroke="#6b5549" stroke-width="1.3"/>
        <g class="player-eyes"><ellipse cx="37.5" cy="48" rx="3.1" ry="4.8" fill="#263744"/><ellipse cx="67.5" cy="48" rx="3.1" ry="4.8" fill="#263744"/><ellipse cx="38.3" cy="46.5" rx=".9" ry="1.25" fill="#fff9e7"/><ellipse cx="68.3" cy="46.5" rx=".9" ry="1.25" fill="#fff9e7"/><path d="M36 51h1.5m28.5 0h1.5" stroke="#67818a" stroke-width=".7"/></g>
        <path d="M52 50q4 2 1 4" stroke="#c18a6d" stroke-width=".9"/><path d="M51 50.5h1" stroke="#fff4d9" stroke-width="1.3"/>
        <path v-if="pose === 'miss'" d="M47 61q5-4 11 0" stroke="#8a5d50" stroke-width="1.6"/>
        <g v-else-if="pose === 'celebrate'"><path d="M43 56q9 3 18-.5c-.7 8-4.7 10-9 10s-7.5-2.5-9-9.5Z" fill="#754b44"/><path d="M45 57q7 1.5 14 0l-1 2q-7 2-12 0Z" fill="#fff6dc"/><path d="M48 64q4-4 9-.5" fill="#dd8d80"/></g>
        <path v-else d="M46 58q6 6 13-1" stroke="#815b4d" stroke-width="1.6"/>
        <path d="M49 63q4 1 7-.5" stroke="#fff0d0" stroke-width="1.4" opacity=".65"/>
      </g>
      <g class="player-front-arm">
        <path d="M73 76c5 4 8 5 12 1l3-11c1-4 4-5 6-3 3-1 5 2 4 6-1 9-6 17-13 20-7 3-13 0-17-5" :fill="paint('limb')" stroke="#ba876a" stroke-width=".9"/>
        <path d="M74 79q5 5 11 1" stroke="#fff1d0" stroke-width="2.1" opacity=".65"/>
        <path d="M90 68q-4-3-6 1-1 3 3 4m7-9-1 5m4-2-1 4" stroke="#bc8c71" stroke-width=".8"/>
        <path d="m84 77 10 4-3 4-10-4Z" :fill="paint('shoe')" stroke="#b1b5a8" stroke-width=".65"/><path d="m83 80 9 3" stroke="var(--jersey)" stroke-width="1.1"/><path d="m85 78 7 3" stroke="#fffdf0" stroke-width=".65"/>
      </g>
    </g>
  </svg>
</template>
