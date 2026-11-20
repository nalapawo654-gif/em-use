// EM Use plays its animations by default. Only the app's own 轻柔模式 (settings.reducedMotion,
// off by default) turns them down; the OS "reduce motion" / Windows "animation effects" switch
// is ignored, because office PCs and remote desktops often have it off and users would never
// see the pets move. CSS `@media (prefers-reduced-motion: reduce)` blocks are disabled at build
// time by the matching Vite plugin (vite.config.ts); this covers runtime `matchMedia` checks.
// Must be the first module evaluated in every entry.
const REDUCED = /prefers-reduced-motion\s*:\s*reduce/i
const native = window.matchMedia.bind(window)
window.matchMedia = (query: string) => native(REDUCED.test(query) ? 'not all' : query)
export {}
