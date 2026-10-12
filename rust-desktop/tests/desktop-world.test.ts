import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS } from '../src/shared/types'
import { validateSettings } from '../src/shared/settings'

test('old preferences keep the world disabled and preserve the pet on world changes', () => {
  const old = { ...DEFAULT_SETTINGS, ...validateSettings({ scene: 'potato', windowWidth: 300, alwaysOnTop: false }) }
  assert.equal(old.worldEnabled, false)
  const next = { ...old, ...validateSettings({ worldEnabled: true, worldPaused: true, account: 'ignored' }) }
  assert.deepEqual(next, { ...old, worldEnabled: true, worldPaused: true })
  assert.deepEqual(validateSettings({ worldEnabled: 1, worldPaused: 'false', scene: 'riverbed' }), {})
  assert.deepEqual(validateSettings(JSON.parse(JSON.stringify(next))), next)
})
