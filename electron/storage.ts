import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type Settings } from '../src/shared/types.js'
import { captureHeaders, type AuthHeaders } from '../src/shared/quota.js'

function path(name: string) { mkdirSync(app.getPath('userData'), { recursive: true }); return join(app.getPath('userData'), name) }
function write(name: string, data: string | Buffer) {
  const dest = path(name), temp = `${dest}.tmp`
  writeFileSync(temp, data, { mode: 0o600 }); renameSync(temp, dest)
}
export function readCredentials(): AuthHeaders | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    return captureHeaders(JSON.parse(safeStorage.decryptString(readFileSync(path('session.enc')))))
  } catch { return null }
}
export function saveCredentials(headers: AuthHeaders): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  try { write('session.enc', safeStorage.encryptString(JSON.stringify(headers))); return true } catch { return false }
}
export function clearCredentials() {
  if (existsSync(path('session.enc'))) unlinkSync(path('session.enc'))
}
export function validateSettings(input: unknown): Partial<Settings> {
  if (!input || typeof input !== 'object') return {}
  const data = input as Record<string, unknown>, out: Record<string, unknown> = {}
  for (const key of ['alwaysOnTop', 'clickThrough', 'launchAtLogin', 'reducedMotion', 'notifications']) {
    if (typeof data[key] === 'boolean') out[key] = data[key]
  }
  if (typeof data.size === 'string' && ['standard', 'compact', 'mini'].includes(data.size)) out.size = data.size
  if (typeof data.theme === 'string' && ['auto', 'day', 'night'].includes(data.theme)) out.theme = data.theme
  if (typeof data.outfit === 'string' && ['classic', 'sailor', 'royal', 'ribbon'].includes(data.outfit)) out.outfit = data.outfit
  return out as Partial<Settings>
}
export function readSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...validateSettings(JSON.parse(readFileSync(path('preferences.json'), 'utf8'))) } }
  catch { return { ...DEFAULT_SETTINGS } }
}
export function saveSettings(settings: Settings) { write('preferences.json', JSON.stringify(settings)) }
export function readPosition(): { x: number; y: number } | null {
  try {
    const p = JSON.parse(readFileSync(path('position.json'), 'utf8'))
    return Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null
  } catch { return null }
}
export function savePosition(x: number, y: number) { write('position.json', JSON.stringify({ x, y })) }
