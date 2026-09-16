import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function createCiConfig(target, env, committed) {
  if (!['x86_64-pc-windows-msvc', 'aarch64-apple-darwin', 'x86_64-apple-darwin'].includes(target)) throw new Error('Expected a supported packaging target')
  // macOS distributes DMGs only; its release must not depend on updater signing keys.
  if (target.endsWith('-apple-darwin')) return { bundle: { createUpdaterArtifacts: false, macOS: { signingIdentity: '-' } } }
  const key = env.TAURI_SIGNING_PRIVATE_KEY
  const pubkey = (env.TAURI_UPDATER_PUBLIC_KEY || committed).trim()
  if (committed && pubkey !== committed) throw new Error('Actions public key differs from the application key; refusing accidental key rotation')
  if (env.RELEASE_BUILD === 'true' && (!key || !pubkey)) throw new Error('Configure TAURI_SIGNING_PRIVATE_KEY secret and TAURI_UPDATER_PUBLIC_KEY variable before a Windows release build')
  return { bundle: { createUpdaterArtifacts: !!(key && pubkey) }, plugins: { updater: { pubkey } } }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const committed = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).plugins.updater.pubkey.trim()
  writeFileSync('src-tauri/ci.conf.json', JSON.stringify(createCiConfig(process.argv[2], process.env, committed), null, 2))
}
