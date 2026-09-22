// Compile the existing shared validator into data consumed by Rust, avoiding a second settings rulebook.
import { writeFileSync } from 'node:fs'
import { DEFAULT_SETTINGS, SCENE_LABELS } from '../src/shared/types'
import { PRESET_WIDTHS } from '../src/shared/windowGeometry'
import { SETTINGS_ENUMS, validateSettings } from '../src/shared/settings'
const strings = Object.values(SETTINGS_ENUMS).flat()
const enums: Record<string, string[]> = {}
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) if (typeof value === 'string') {
  enums[key] = [...new Set(strings.filter(candidate => key in validateSettings({ [key]: candidate })))]
  if (!enums[key].includes(value)) throw new Error(`Missing default: ${key}`)
}
const data = { defaults: DEFAULT_SETTINGS, enums, labels: SCENE_LABELS, presets: PRESET_WIDTHS }
writeFileSync(new URL('../src-tauri/src/settings-contract.json', import.meta.url), JSON.stringify(data, null, 2) + '\n')
