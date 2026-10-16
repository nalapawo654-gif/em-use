import { computed, shallowReactive } from 'vue'

// Active renderers register while decoding. A cold atlas must not consume the
// ceremony before the replacement costume can actually be painted.
const loading = shallowReactive(new Set<symbol>())
export const evolutionAssetsReady = computed(() => loading.size === 0)
export function setEvolutionLoading(owner: symbol, pending: boolean) {
  if (pending) loading.add(owner)
  else loading.delete(owner)
}

const cinematic = shallowReactive(new Set<symbol>())
export const evolutionCinematicActive = computed(() => cinematic.size > 0)
export function setEvolutionCinematic(owner: symbol, active: boolean) {
  if (active) cinematic.add(owner)
  else cinematic.delete(owner)
}
