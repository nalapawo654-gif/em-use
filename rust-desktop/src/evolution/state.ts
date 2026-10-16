export type EvolutionPhase = 'idle' | 'gather' | 'unfold' | 'reveal' | 'settle' | 'return'
export interface EvolutionInput {
  source: string; scene: string; appearance?: string; enabled: boolean; ready: boolean; retain: boolean;
  assetsReady?: boolean; blocked: boolean; hidden: boolean; motion: 'full' | 'light' | 'off';
}
export interface EvolutionState {
  initialized: boolean; source: string; scene: string; appearance: string; awake: boolean;
  pending: boolean; kind: 'source' | 'appearance'; phase: EvolutionPhase; started: number; duration: number;
}
export const initialEvolution = (): EvolutionState => ({ initialized: false, source: '', scene: '', appearance: '', awake: false, pending: false, kind: 'source', phase: 'idle', started: 0, duration: 1600 })

// Explicit source, pet and visible costume changes arm one ceremony. Hydration,
// quota refresh and reconnects never re-arm it; busy windows keep only the latest selection.
export function stepEvolution(previous: EvolutionState, input: EvolutionInput, now: number): EvolutionState {
  const s = { ...previous }
  const eligible = input.source === 'codex' && input.enabled
  const target = eligible && (input.ready || input.retain && s.awake)
  const appearance = input.appearance ?? input.scene
  if (!s.initialized) return { ...s, initialized: true, source: input.source, scene: input.scene, appearance, awake: target }
  const sourceChanged = input.source !== s.source
  const appearanceChanged = s.scene !== input.scene || s.appearance !== appearance
  if (sourceChanged || appearanceChanged) {
    s.source = input.source; s.scene = input.scene; s.appearance = appearance
    s.pending = true; s.phase = 'idle'; s.kind = sourceChanged ? 'source' : 'appearance'
    if (!sourceChanged) s.awake = target
  }
  if (!eligible && !s.awake && s.kind === 'source') s.pending = false
  // Losing confirmed identity cancels the visual effect. A same-account stale
  // snapshot can retain its costume, but does not arm a new source ceremony.
  if (eligible && !input.ready && !input.retain) { s.awake = false; s.phase = 'idle' }
  if (input.hidden || input.motion === 'off') return { ...s, awake: target, phase: 'idle', pending: false }
  if (s.phase !== 'idle' && input.blocked) return { ...s, awake: target, phase: 'idle', pending: false }
  // A live system preference change must shorten the already-running ceremony.
  if (s.phase !== 'idle' && input.motion === 'light' && s.duration > 200) return { ...s, awake: target, duration: 200, started: now, phase: eligible ? 'unfold' : 'return' }
  const canStart = s.kind === 'appearance' || input.ready || !eligible
  if (s.pending && !input.blocked && canStart && (!target || input.assetsReady !== false)) {
    s.pending = false; s.started = now
    s.duration = input.motion === 'light' ? 200 : s.kind === 'appearance' ? (target ? 1600 : 800) : eligible ? 1600 : 600
    if (s.kind === 'source' && target === s.awake) return { ...s, awake: target, phase: 'idle' }
    s.phase = s.kind === 'appearance' ? 'unfold' : eligible ? 'gather' : 'return'
    if (input.motion === 'light') s.awake = target
  }
  if (s.phase !== 'idle') {
    const elapsed = Math.max(0, now - s.started)
    if (elapsed >= s.duration) return { ...s, awake: target, phase: 'idle' }
    if (s.duration > 200) {
      if (s.kind === 'appearance') s.phase = elapsed < 500 ? 'unfold' : 'reveal'
      else if (!eligible) {
        s.phase = elapsed < 300 ? 'return' : 'reveal'
        if (elapsed >= 300) s.awake = false
      } else {
        s.phase = elapsed < 300 ? 'gather' : elapsed < 800 ? 'unfold' : elapsed < 1300 ? 'reveal' : 'settle'
        if (elapsed >= 300) s.awake = true
      }
    }
  } else if (!s.pending) s.awake = target
  return s
}
