<script setup lang="ts">
// Shared startup "hatch": a light orb gathers where the pet stands, cracks open and
// morphs into a white silhouette of the current pet, which then colours in.
// It drives every pet through the common `.evolution-actor` hook, so no pet owns
// a copy. Plays once per widget WebView (tray restore / scene switch never replay).
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { appState, stateReady } from '../bridge'
import { setEvolutionBlocked } from '../evolution/controller'

export type HatchPhase = 'pending' | 'gather' | 'crack' | 'morph' | 'reveal' | 'done'
const props = defineProps<{ enabled: boolean }>()
const DURATION = { gather: 900, crack: 520, morph: 560, reveal: 620 } as const
const phase = ref<HatchPhase>(props.enabled && !played ? 'pending' : 'done')
const orb = ref({ x: 0, y: 0, size: 96 })
const owner = Symbol('startup-hatch')
let timers: number[] = [], raf = 0, disposed = false
const sparks = Array.from({ length: 10 }, (_, i) => ({ '--a': `${i * 36 + (i % 2) * 14}deg`, '--d': `${(i % 5) * 70}ms` }))
const style = computed(() => ({ left: `${orb.value.x}px`, top: `${orb.value.y}px`, '--orb': `${orb.value.size}px` }))

function setPhase(next: HatchPhase) {
  phase.value = next
  if (next === 'done') { delete document.documentElement.dataset.petIntro; setEvolutionBlocked(owner, false) }
  else document.documentElement.dataset.petIntro = next
}
function finish() {
  timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf)
  window.removeEventListener('pointerdown', finish, true); window.removeEventListener('keydown', key, true)
  if (phase.value !== 'done') setPhase('done')
}
function key(event: KeyboardEvent) { if (event.key === 'Escape') { event.stopPropagation(); finish() } }
function actorBox() {
  const actors = [...document.querySelectorAll<HTMLElement>('.pet-arc-host .evolution-actor, .pet-arc-host [data-pet-actor]')]
  const box = actors.map(a => a.getBoundingClientRect()).filter(r => r.width > 8 && r.height > 8).sort((a, b) => b.width * b.height - a.width * a.height)[0]
  return box
}
function place() {
  const box = actorBox(), host = document.querySelector('.pet-arc-host')?.getBoundingClientRect()
  const base = box ?? host ?? new DOMRect(0, 0, innerWidth, innerHeight)
  // Sit a little below the middle: most pets stand, so the light gathers at their chest.
  orb.value = { x: base.x + base.width / 2, y: base.y + base.height * (box ? .58 : .55), size: Math.max(56, Math.min(180, Math.min(base.width, base.height) * .36)) }
  return !!box
}
function track(until: number) {
  if (disposed || phase.value === 'done') return
  const found = place()
  if (!found && performance.now() < until) raf = requestAnimationFrame(() => track(until))
}
function at(ms: number, fn: () => void) { timers.push(window.setTimeout(fn, ms)) }

onMounted(async () => {
  if (phase.value === 'done') return
  played = true
  document.documentElement.dataset.petIntro = 'pending'
  setEvolutionBlocked(owner, true)
  await Promise.race([stateReady, new Promise(r => setTimeout(r, 1500))])
  // Only EM Use's own 轻柔模式 opts out; the OS animation switch is often off on
  // office PCs / remote desktops and would silently hide the effect.
  if (disposed || document.hidden || appState.settings.reducedMotion || appState.settings.startupHatch === false) { finish(); return }
  window.addEventListener('pointerdown', finish, true); window.addEventListener('keydown', key, true)
  setPhase('gather'); track(performance.now() + 1200)
  let t = DURATION.gather
  at(t, () => { place(); setPhase('crack') }); t += DURATION.crack
  at(t, () => setPhase('morph')); t += DURATION.morph
  at(t, () => setPhase('reveal')); t += DURATION.reveal
  at(t, finish)
  // Hidden WebViews may throttle timers; never leave the pet invisible.
  at(t + 2500, finish)
})
onUnmounted(() => { disposed = true; finish() })
</script>
<script lang="ts">
let played = false
</script>
<template>
  <div v-if="phase !== 'done' && phase !== 'pending'" class="pet-hatch" :class="'phase-' + phase" :style="style" aria-hidden="true">
    <span class="hatch-rays"></span>
    <span class="hatch-halo"></span>
    <span class="hatch-core"><i class="hatch-crack c1"></i><i class="hatch-crack c2"></i><i class="hatch-crack c3"></i></span>
    <i v-for="(s, i) in sparks" :key="i" class="hatch-spark" :style="s"></i>
    <span class="hatch-flash"></span>
  </div>
</template>
<style>
/* While hatching, the pet's scene stays hidden; only the painted actor reappears for the morph. */
html[data-pet-intro] .pet-arc-host { visibility: hidden; }
html[data-pet-intro="morph"] .pet-arc-host :is(.evolution-actor, [data-pet-actor]),
html[data-pet-intro="reveal"] .pet-arc-host :is(.evolution-actor, [data-pet-actor]) { visibility: visible; transform-origin: 50% 82%; }
html[data-pet-intro="morph"] .pet-arc-host :is(.evolution-actor, [data-pet-actor]) { animation: pet-hatch-morph .56s cubic-bezier(.2,.8,.2,1) both !important; }
html[data-pet-intro="reveal"] .pet-arc-host :is(.evolution-actor, [data-pet-actor]) { animation: pet-hatch-reveal .62s ease-out both !important; }
@keyframes pet-hatch-morph {
  from { opacity: 0; transform: scale(.42); filter: brightness(0) invert(1) drop-shadow(0 0 10px #fff6d8); }
  55% { opacity: 1; }
  to { opacity: 1; transform: scale(1.05); filter: brightness(0) invert(1) drop-shadow(0 0 14px #ffe29a); }
}
@keyframes pet-hatch-reveal {
  from { transform: scale(1.05); filter: brightness(0) invert(1) drop-shadow(0 0 14px #ffe29a); }
  40% { filter: brightness(1.7) saturate(.6) drop-shadow(0 0 10px #ffe29a); }
  70% { transform: scale(.985); }
  to { transform: scale(1); filter: none; }
}

.pet-hatch { position: fixed; z-index: 2147483000; width: var(--orb); height: var(--orb); translate: -50% -50%; pointer-events: none; transition: left .3s ease-out, top .3s ease-out; }
.pet-hatch > * { position: absolute; inset: 0; border-radius: 50%; }
.hatch-core { background: radial-gradient(circle at 42% 38%, #fff 0 18%, #fff4cf 34%, #ffd36b 58%, #f0a13a00 72%); box-shadow: 0 0 calc(var(--orb) * .35) #ffd77a99; animation: hatch-grow .9s cubic-bezier(.2,.9,.3,1) both, hatch-bob 1.8s ease-in-out infinite; }
.hatch-halo { inset: -38%; background: radial-gradient(circle, #fff3c4aa 0, #ffd36b33 40%, transparent 68%); animation: hatch-halo 1.6s ease-in-out infinite; }
.hatch-rays { inset: -120%; opacity: 0; background: repeating-conic-gradient(from 0deg, #fff2c0aa 0 4deg, transparent 4deg 24deg); -webkit-mask: radial-gradient(circle, #000 0, #000 18%, transparent 62%); mask: radial-gradient(circle, #000 0, #000 18%, transparent 62%); }
.hatch-spark { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px; border-radius: 50%; background: #fff; box-shadow: 0 0 8px 2px #ffd970; rotate: var(--a); animation: hatch-spark .8s var(--d) cubic-bezier(.5,0,.8,.4) both; }
.hatch-crack { position: absolute; left: 50%; top: 50%; width: 2px; height: 0; background: #fff; box-shadow: 0 0 6px 2px #fff7d6; transform-origin: 50% 0; opacity: 0; }
.hatch-crack.c1 { rotate: 20deg; } .hatch-crack.c2 { rotate: 150deg; } .hatch-crack.c3 { rotate: 260deg; }
.hatch-flash { inset: -60%; opacity: 0; background: radial-gradient(circle, #fff 0, #fffbe9 30%, transparent 66%); }

.pet-hatch.phase-crack .hatch-core { animation: hatch-shake .52s linear both; }
.pet-hatch.phase-crack .hatch-crack { animation: hatch-split .5s ease-out both; }
.pet-hatch.phase-crack .c2 { animation-delay: .12s; } .pet-hatch.phase-crack .c3 { animation-delay: .24s; }
.pet-hatch.phase-crack .hatch-rays { animation: hatch-rays .52s ease-in both; }
.pet-hatch.phase-crack .hatch-spark, .pet-hatch.phase-morph .hatch-spark, .pet-hatch.phase-reveal .hatch-spark { display: none; }
.pet-hatch.phase-morph .hatch-core { animation: hatch-burst .32s ease-in both; }
.pet-hatch.phase-morph .hatch-halo { animation: hatch-burst .4s ease-in both; }
.pet-hatch.phase-morph .hatch-rays { opacity: .9; animation: hatch-rays-out .56s ease-out both; }
.pet-hatch.phase-morph .hatch-flash { animation: hatch-flash .56s ease-out both; }
.pet-hatch.phase-reveal > *:not(.hatch-rays) { display: none; }
.pet-hatch.phase-reveal .hatch-rays { animation: hatch-rays-fade .5s ease-out both; }

@keyframes hatch-grow { from { scale: .08; opacity: 0; } 60% { opacity: 1; } to { scale: 1; opacity: 1; } }
@keyframes hatch-bob { 50% { translate: 0 -4%; } }
@keyframes hatch-halo { 50% { scale: 1.12; opacity: .75; } }
@keyframes hatch-spark { from { transform: translateY(calc(var(--orb) * -1.4)) scale(1.2); opacity: 0; } 30% { opacity: 1; } to { transform: translateY(0) scale(.3); opacity: 0; } }
@keyframes hatch-shake { 0%,100% { rotate: 0deg; scale: 1; } 15% { rotate: -6deg; } 30% { rotate: 5deg; scale: 1.04; } 45% { rotate: -4deg; } 60% { rotate: 4deg; scale: 1.08; } 80% { rotate: -2deg; scale: 1.12; } }
@keyframes hatch-split { from { height: 0; opacity: 1; } to { height: 48%; opacity: 1; } }
@keyframes hatch-rays { from { opacity: 0; rotate: 0deg; } to { opacity: .55; rotate: 25deg; } }
@keyframes hatch-burst { to { scale: 1.9; opacity: 0; } }
@keyframes hatch-rays-out { from { rotate: 25deg; scale: .8; } to { rotate: 60deg; scale: 1.5; opacity: .5; } }
@keyframes hatch-rays-fade { from { rotate: 60deg; scale: 1.5; opacity: .5; } to { rotate: 80deg; scale: 1.8; opacity: 0; } }
@keyframes hatch-flash { 0% { opacity: 0; scale: .3; } 25% { opacity: 1; } to { opacity: 0; scale: 1.6; } }
</style>
