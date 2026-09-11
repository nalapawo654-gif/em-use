import { readFileSync, writeFileSync } from 'node:fs'
const release=process.env.RELEASE_BUILD==='true'
const committed=JSON.parse(readFileSync('src-tauri/tauri.conf.json','utf8')).plugins.updater.pubkey.trim()
const key=process.env.TAURI_SIGNING_PRIVATE_KEY
const pubkey=(process.env.TAURI_UPDATER_PUBLIC_KEY||committed).trim()
if (committed && pubkey!==committed) throw new Error('Actions public key differs from the application key; refusing accidental key rotation')
if (release && (!key || !pubkey)) throw new Error('Configure TAURI_SIGNING_PRIVATE_KEY secret and TAURI_UPDATER_PUBLIC_KEY variable before a release build')
writeFileSync('src-tauri/ci.conf.json',JSON.stringify({bundle:{createUpdaterArtifacts:!!(key&&pubkey)},plugins:{updater:{pubkey}}},null,2))
