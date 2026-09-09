import { spawn } from 'node:child_process'
import { createServer } from 'vite'
import electron from 'electron'
const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  p.on('exit', code => code === 0 ? resolve() : reject(new Error(`Build exited ${code}`)))
})
await run('npx', ['tsc', '-p', 'tsconfig.electron.json'])
const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } })
await server.listen()
const env = { ...process.env, EM_USE_DEV_URL: 'http://127.0.0.1:5173' }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, ['.'], { stdio: 'inherit', env })
child.on('exit', async (code, signal) => { await server.close(); if (signal) console.error(`Electron stopped: ${signal}`); process.exit(code ?? (signal ? 1 : 0)) })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
