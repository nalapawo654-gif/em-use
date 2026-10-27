import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({ plugins: [vue()], base: './', server: { port: 5174, strictPort: true, proxy: { '/collaboration-api': { target: process.env.VITE_COLLABORATION_DEV_SERVER || 'http://127.0.0.1:8797', changeOrigin: true, rewrite: path => path.replace(/^\/collaboration-api/, '') } } }, build: { outDir: 'dist', rollupOptions: { input: { app: 'index.html', world: 'world.html', startup: 'startup.html', collaboration: 'collaboration.html' } } } })
