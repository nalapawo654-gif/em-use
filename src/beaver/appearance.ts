/** Quota is the sole source of the paired expression, posture and tree damage. */
export const BEAVER_APPEARANCES = [
  { expression:'元气满满', tree:'完整树干', removed:0, headDrop:0, bodyScale:1, strain:0 },
  { expression:'轻松啃树', tree:'浅浅啃痕', removed:0.25, headDrop:6, bodyScale:.98, strain:0 },
  { expression:'用力坚持', tree:'明显缺口', removed:0.5, headDrop:20, bodyScale:.91, strain:.25 },
  { expression:'疲惫冒汗', tree:'深度啃损', removed:0.75, headDrop:40, bodyScale:.82, strain:.65 },
  { expression:'精疲力尽', tree:'即将啃断', removed:0.9, headDrop:68, bodyScale:.70, strain:1 },
  { expression:'趴下休息', tree:'倒木树桩', removed:1, headDrop:80, bodyScale:.65, strain:0 },
] as const
export function beaverAppearance(level: number) { return BEAVER_APPEARANCES[Math.max(0,Math.min(5,Math.floor(Number.isFinite(level)?level:0)))] }
