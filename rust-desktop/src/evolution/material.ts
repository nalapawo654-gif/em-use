import { evolutionCinematicActive } from './readiness'
import { shallowRef, watchEffect, type ObjectDirective } from 'vue'
import type { Scene } from '../shared/types'
import { quotaDisplay } from '../bridge'
import { evolution, evolutionHidden, evolutionMotion } from './controller'
import { awakeningEnergy, awakeningStyle, isRestingPose } from './wardrobe'
import './material.css'

export interface MaterialBinding { scene: Scene; skin: string; pose?: string; percent?: number | null; paused?: boolean; cinematic?: boolean }
const mounted = new WeakMap<HTMLElement, { value: ReturnType<typeof shallowRef<MaterialBinding>>; stop: () => void }>()

// This effect consumes the actor's rendered alpha, after its original clothing,
// frame selection and joints. It cannot acquire a different silhouette or drift
// away from a moving shoulder. No coordinates, atlas crops or skin fallbacks.
export const vEvolutionMaterial: ObjectDirective<HTMLElement, MaterialBinding> = {
  mounted(el, binding) {
    const value = shallowRef(binding.value)
    let started = -1
    const stop = watchEffect(() => {
      const b = value.value, style = awakeningStyle(b.scene, b.skin)
      const fresh = quotaDisplay.value.status === 'ready'
      const energy = awakeningEnergy(b.percent === undefined ? quotaDisplay.value.percent : b.percent, isRestingPose(b.pose), fresh)
      const active = !!style && evolution.awake
      el.classList.add('evolution-actor')
      el.classList.toggle('evolution-material', active)
      el.dataset.awakeningSkin = `${b.scene}/${b.skin}`
      el.dataset.cinematic = String(!!b.cinematic || (evolutionCinematicActive.value && b.scene === evolution.scene))
      el.dataset.awakeningPose = b.pose ?? 'idle'
      el.dataset.awakeningPhase = evolutionHidden.value || b.cinematic || (evolutionCinematicActive.value && b.scene === evolution.scene) ? 'idle' : evolution.phase
      el.dataset.awakeningEnergy = energy.toFixed(2)
      el.dataset.awakeningMotion = evolutionMotion.value
      el.dataset.awakeningDirection = evolution.kind === 'source' && evolution.source !== 'codex' ? 'return' : 'forward'
      el.style.setProperty('--awakening-edge', style?.edge ?? 'transparent')
      el.style.setProperty('--awakening-light', style?.light ?? 'transparent')
      // Zero/unknown/stale/resting never emits a live-energy halo. The original
      // costume and authored exhausted/resting pose remain legible throughout.
      el.style.setProperty('--awakening-radius', `${(energy * 2.8).toFixed(2)}px`)
      el.style.setProperty('--awakening-rim', energy > 0 ? '0.65px' : '0px')
      el.style.setProperty('--awakening-saturation', `${1 + energy * .045}`)
      if (evolution.phase !== 'idle' && started !== evolution.started) {
        started = evolution.started
        // Consecutive wardrobe choices can share a phase and DOM node.
        for (const animation of el.getAnimations()) {
          if (animation instanceof CSSAnimation && animation.animationName.startsWith('evolution-body-')) animation.currentTime = 0
        }
      }
    })
    mounted.set(el, { value, stop })
  },
  updated(el, binding) { const state = mounted.get(el); if (state) state.value.value = binding.value },
  beforeUnmount(el) { mounted.get(el)?.stop(); mounted.delete(el) },
}
