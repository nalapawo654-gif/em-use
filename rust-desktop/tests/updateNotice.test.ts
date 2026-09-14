import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UPDATE_PERSONAS, updateNoticeVisible, updateProgress } from '../src/shared/updateNotice'
import { SCENE_LABELS } from '../src/shared/types'

test('every selectable companion has its own delivery object and motion', () => {
  assert.deepEqual(Object.keys(UPDATE_PERSONAS).sort(), Object.keys(SCENE_LABELS).sort())
  assert.equal(new Set(Object.values(UPDATE_PERSONAS).map(p => p.object)).size, 11)
  assert.equal(new Set(Object.values(UPDATE_PERSONAS).map(p => p.motion)).size, 11)
})
test('only actionable version states become pet mail, never background failures or quota states', () => {
  assert.equal(updateNoticeVisible(undefined), false)
  assert.equal(updateNoticeVisible({ status: 'error', message: 'offline' }), false)
  for (const status of ['idle','checking','current'] as const) assert.equal(updateNoticeVisible({ status, version: '0.5.0', message: '' }), false)
  for (const status of ['available','downloading','installing','error'] as const) assert.equal(updateNoticeVisible({ status, version: '0.5.0', message: '' }), true)
})
test('unknown transfer length stays indeterminate; bounded byte progress never implies installed', () => {
  const base = { status: 'downloading' as const, message: '' }
  assert.equal(updateProgress({ ...base, downloaded: 123 }), null)
  assert.equal(updateProgress({ ...base, downloaded: 123, total: 0 }), null)
  assert.equal(updateProgress({ ...base, downloaded: NaN, total: 100 }), null)
  assert.equal(updateProgress({ ...base, downloaded: 123, total: 100 }), 100)
  assert.equal(updateProgress({ ...base, downloaded: -10, total: 100 }), 0)
  assert.equal(updateProgress({ ...base, downloaded: 42, total: 100 }), 42)
})
