<script setup lang="ts">
import { useId } from 'vue'
defineProps<{ scored?: boolean }>()
const id = useId()
const paint = (name: string) => `url(#${id}-${name})`
</script>
<template>
  <g class="hoop-court-materials" stroke-linecap="round" stroke-linejoin="round">
    <defs>
      <linearGradient :id="`${id}-steel`" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#193441"/><stop offset=".28" stop-color="#5e7d88"/><stop offset=".5" stop-color="#2d4f5e"/><stop offset="1" stop-color="#1a303b"/></linearGradient>
      <linearGradient :id="`${id}-base`" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#789397"/><stop offset=".4" stop-color="#446572"/><stop offset="1" stop-color="#294551"/></linearGradient>
      <linearGradient :id="`${id}-glass`" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#f6ffef" stop-opacity=".85"/><stop offset=".4" stop-color="#c5ded6" stop-opacity=".48"/><stop offset="1" stop-color="#91b5b7" stop-opacity=".65"/></linearGradient>
      <linearGradient :id="`${id}-edge`" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#789598"/><stop offset=".4" stop-color="#e4ede1"/><stop offset="1" stop-color="#557983"/></linearGradient>
      <linearGradient :id="`${id}-rim`" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f4ae6b"/><stop offset=".45" stop-color="#dc693c"/><stop offset="1" stop-color="#8c392b"/></linearGradient>
      <radialGradient :id="`${id}-shadow`"><stop stop-color="#173440" stop-opacity=".24"/><stop offset="1" stop-color="#173440" stop-opacity="0"/></radialGradient>
    </defs>
    <!-- A few court markings leave the desktop visible between objects. -->
    <g class="hoop-floor" fill="none" stroke-width="1.15">
      <path d="M35 341 313 312 405 340 128 374Z"/>
      <path d="m296 315 38 12-87 10-38-12m43 1q-31 4-11 10M134 330q-69 26 18 42"/>
      <path d="m135 330 5-.5m-16 7 4-1m-7 9 5-1m9 10 5-1m8 12 5-1" stroke-width=".7"/>
      <path d="m44 354 10-1m4-1 10-1m4-1 10-1" stroke-dasharray="2 2"/>
    </g>
    <ellipse cx="381" cy="340" rx="35" ry="8" :fill="paint('shadow')"/>
    <!-- Weighted base, rubber feet, beveled post and adjustment sleeve. -->
    <path d="m354 335 12-8 28-2 19 9v5q-31 9-59 2Z" fill="#233d48" stroke="#203642" stroke-width=".8"/>
    <path d="m354 335 12-8 28-2 19 9q-31 10-59 5Z" :fill="paint('base')" stroke="#6d898c" stroke-width=".8"/>
    <path d="m361 333 9-3 20-1 12 5-19 4-16-1Z" fill="#304e59" stroke="#76928e" stroke-width=".6"/>
    <path d="m357 338 5 1m40-1 6-1" stroke="#9aac9f" stroke-width="1"/>
    <path d="m360 341 0 2 6 .5v-2m35-1 0 2 7-1v-2" fill="#21323c"/>
    <path d="M377 178h10v143l-9 12-8-2 7-13Z" :fill="paint('steel')" stroke="#26434e" stroke-width="1"/>
    <path d="M379 183v135l-7 12" stroke="#9cb1aa" stroke-width=".85"/>
    <path d="M376 233h12v25l-12 1Z" fill="#2d4b58" stroke="#1d3743" stroke-width=".7"/>
    <path d="m378 235 7-.4v20l-7 .7" stroke="#6d8b91" stroke-width=".7"/>
    <circle cx="386" cy="245" r="2.3" fill="#1c3442" stroke="#879b97" stroke-width=".6"/>
    <path d="M381 273h3v25h-3Z" fill="#e4a168"/><path d="M382.5 278v12" stroke="#f9dfaa" stroke-width=".5"/>
    <path d="m384 202 15-26 4 2-19 34Z" fill="#375967" stroke="#66868d" stroke-width=".7"/>
    <!-- The collision face stays at x=378, y=102..196. -->
    <path d="m378 102 6 1v93l-6-2Z" :fill="paint('edge')" stroke="#2c4b58" stroke-width="1.15"/>
    <path d="m384 103 39 13v60l-39 20Z" :fill="paint('glass')" stroke="#2b4c5b" stroke-width="2"/>
    <path d="m387 107 33 11v56l-33 17Z" fill="none" stroke="#dbeade" stroke-width=".8"/>
    <path d="m391 110 5 2-8 48v-28Zm15 5 9 3-13 65-9 5Z" fill="#fffce9" opacity=".27"/>
    <path d="m391 135 24 6v20l-24 2Z" fill="none" stroke="#fcf4df" stroke-width="3.4" opacity=".7"/>
    <path d="m391 135 24 6v20l-24 2Z" fill="none" stroke="#dd754b" stroke-width="1.9"/>
    <path d="m384 191 39-19v4l-39 20Z" fill="#294956"/>
    <path d="m386 191 35-17" stroke="#779795" stroke-width=".7"/>
    <g fill="#ebeee0" stroke="#4b6a71" stroke-width=".65"><circle cx="388" cy="113" r="1.2"/><circle cx="419" cy="121" r="1"/><circle cx="388" cy="185" r="1.2"/><circle cx="419" cy="172" r="1"/></g>
    <path d="m397 122 0 5m2-4v4m2-3v3" stroke="#426370" stroke-width=".6" opacity=".75"/>
    <!-- Diamond mesh, tied eyelets and a softly weighted lower seam. -->
    <g class="hoop-net" :class="{ 'net-score': scored }" fill="none">
      <path d="M319 177 326 207q14 5 28 0l7-30" stroke="#607d83" stroke-width="1.4"/>
      <path d="m320 180 10 8-6 9 9 10m-5-29 9 11-8 9 11 11m-3-30 8 10-9 10 11 10m-1-31 8 10-10 11 8 9m4-31-8 11 10 9-9 11" stroke="#728d90" stroke-width="1.45"/>
      <path d="m320 179 10 8-6 9 9 10m-5-29 9 11-8 9 11 11m-3-30 8 10-9 10 11 10m-1-31 8 10-10 11 8 9m4-31-8 11 10 9-9 11" stroke="#f5f1db" stroke-width=".65"/>
      <path d="M326 207q14 5 28 0" stroke="#b6c3b8" stroke-width="1.2"/>
      <path d="m321 176 1 3m7-3 1 3m7-2v3m8-3v3m8-4-1 3m7-4-1 3" stroke="#f9edce" stroke-width="1.2"/>
    </g>
    <path d="M374 169h5v13h-5Z" fill="#9d4c34" stroke="#643c32" stroke-width=".8"/>
    <path d="M361 176h16m-14 2 10 3" stroke="#a74b31" stroke-width="2.7"/>
    <path d="M318 176q22-8 44 0" :stroke="paint('rim')" stroke-width="3.8" fill="none"/>
    <path d="M320 175q20-6 40 0" stroke="#ffc486" stroke-width=".7" fill="none"/>
    <circle cx="376.5" cy="172" r=".85" fill="#f2d5af"/>
  </g>
</template>
