import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
// EM Use ignores the OS reduce-motion preference; only the app's 轻柔模式 reduces animation.
// Turn CSS `@media (prefers-reduced-motion: reduce)` blocks into never-matching queries.
// Runtime matchMedia checks are handled by src/motionPolicy.ts.
export const REDUCED_MEDIA = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/gi
const ignoreSystemReducedMotion = (): Plugin => ({
  name: 'em-use:ignore-system-reduced-motion',
  enforce: 'pre',
  transform(code, id) {
    if (!/\.css($|\?)|[?&]type=style/.test(id) || !REDUCED_MEDIA.test(code)) return
    REDUCED_MEDIA.lastIndex = 0
    return { code: code.replace(REDUCED_MEDIA, '@media not all'), map: null }
  },
})
export default defineConfig({ plugins: [ignoreSystemReducedMotion(), vue()], base: './', server: { port: 5174, strictPort: true }, build: { outDir: 'dist', rollupOptions: { input: { app: 'index.html', world: 'world.html' } } } })
