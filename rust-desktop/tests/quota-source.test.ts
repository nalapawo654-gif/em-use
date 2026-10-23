import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS, type AppState } from '../src/shared/types.ts'
import { quotaPresentation, windowLabel, resetLabel } from '../src/shared/quotaSource.ts'
import { validateSettings } from '../src/shared/settings.ts'
const now = 1800000000000
function state(): AppState {
  return { settings: { ...DEFAULT_SETTINGS, quotaSource: 'codex', codexEnabled: true }, status: 'ready', message: 'Cloud', syncing: false, quota: { percent: 99, remaining: 297, used: 3, limit: 300, day: '2027-01-15', estimatedAt: '', serverAt: '', receivedAt: now, exceeded: false }, version: 'test', persistentLogin: false, loginOpen: false,
    codex: { status: 'ready', message: 'Codex', syncing: false, account: null, receivedAt: now, buckets: [{ id: 'codex', name: 'Codex', plan: null, windows: [{ id: 'primary', remainingPercent: 62, windowDurationMins: 300, resetsAt: now / 1000 + 7200 }, { id: 'secondary', remainingPercent: 28, windowDurationMins: 10080, resetsAt: now / 1000 + 172800 }] }, { id: 'other', name: 'Other', plan: null, windows: [{ id: 'primary', remainingPercent: 8, windowDurationMins: 15, resetsAt: null }] }] } }
}
test('selected source keeps money separate and uses limiting window within selected bucket', () => {
  const s = state(); const result = quotaPresentation(s, now)
  assert.equal(result.percent, 28); assert.equal(result.label, 'Codex · 周窗口'); assert.ok(!result.subtitle.includes('¥'))
  s.settings.quotaSource = 'eastmoney'; assert.equal(quotaPresentation(s, now).percent, 99); assert.match(quotaPresentation(s, now).subtitle, /¥297/)
  s.settings.quotaSource = 'codex'; s.settings.codexBucket = 'other'; assert.equal(quotaPresentation(s, now).percent, 8)
})
test('unavailable buckets and missing values never fall back to cloud or invented percentages', () => {
  const s = state(); s.settings.codexBucket = 'missing'; assert.equal(quotaPresentation(s, now).percent, null)
  s.settings.codexBucket = 'codex'; s.codex!.buckets[0]!.windows.forEach(w => w.remainingPercent = null)
  assert.equal(quotaPresentation(s, now).status, 'unavailable'); assert.equal(quotaPresentation(s, now).percent, null)
  s.codex = undefined; assert.equal(quotaPresentation(s, now).status, 'signed-out')
})
test('one known window is usable and zero means zero', () => {
  const s = state(); s.codex!.buckets[0]!.windows[0]!.remainingPercent = null; s.codex!.buckets[0]!.windows[1]!.remainingPercent = 0
  assert.equal(quotaPresentation(s, now).percent, 0)
})
test('server reset deadlines and stale snapshots never replenish quota', () => {
  const s = state(); s.codex!.buckets[0]!.windows[0]!.resetsAt = now / 1000
  assert.equal(quotaPresentation(s, now).status, 'stale'); assert.equal(quotaPresentation(s, now).percent, 28)
  s.codex!.buckets[0]!.windows[0]!.resetsAt = now / 1000 + 7200; assert.equal(quotaPresentation(s, now + 180001).status, 'stale')
  for (const status of ['expired','forbidden','signed-out','unavailable','connecting'] as const) { s.codex!.status = status; assert.equal(quotaPresentation(s, now).percent, null) }
})
test('window names follow actual duration instead of guessing 5 hours or a week', () => {
  const w = state().codex!.buckets[0]!.windows[0]!
  for (const [duration, label] of [[15,'15 分钟窗口'],[120,'2 小时窗口'],[1440,'1 天窗口'],[10080,'周窗口'],[null,'主要窗口']] as const) assert.equal(windowLabel({ ...w, windowDurationMins: duration }),label)
  assert.equal(resetLabel(null),'重置时间未知')
})
test('settings migration defaults and validation preserve platform paths but reject control characters', () => {
  assert.equal(DEFAULT_SETTINGS.quotaSource,'eastmoney'); assert.equal(DEFAULT_SETTINGS.codexEnabled,false)
  assert.deepEqual(validateSettings({ quotaSource: 'codex', codexHome: ' C:\\Users\\Person Name\\.codex ', codexExecutable: '/Applications/Codex.app/Contents/Resources/codex', codexBucket: 'codex', codexEnabled: true }), { quotaSource: 'codex', codexEnabled: true, codexHome: 'C:\\Users\\Person Name\\.codex', codexExecutable: '/Applications/Codex.app/Contents/Resources/codex', codexBucket: 'codex' })
  assert.deepEqual(validateSettings({ quotaSource:'unknown', codexHome:'bad\npath', codexBucket:' ', codexEnabled:'true', codexExecutable:'x'.repeat(4097) }), {})
})

test('disconnect hides even an in-flight cached Codex snapshot', () => {
  const s = state(); s.settings.codexEnabled = false
  const view = quotaPresentation(s, now)
  assert.equal(view.percent, null); assert.equal(view.canRefresh, false); assert.equal(view.status, 'signed-out')
  assert.deepEqual(view.windows, [])
})

test('readout includes both returned windows and keeps shape tied to the lower percentage', () => {
  const s = state()
  const view = quotaPresentation(s, now)
  assert.deepEqual(view.windows.map(w => [windowLabel(w), w.remainingPercent]), [['5 小时窗口', 62], ['周窗口', 28]])
  assert.equal(view.percent, 28)
  s.settings.codexBucket = 'other'
  assert.deepEqual(quotaPresentation(s, now).windows.map(w => w.remainingPercent), [8])
  s.settings.quotaSource = 'eastmoney'
  assert.deepEqual(quotaPresentation(s, now).windows, [])
})

test('weekly-only accounts display only the returned window regardless of plan or window id', () => {
  const s = state()
  s.codex!.account = { id: 'test', name: 'Test', plan: 'pro' }
  const weekly = s.codex!.buckets[0]!.windows[1]!
  s.codex!.buckets[0]!.windows = [{ ...weekly, id: 'primary' }]
  assert.deepEqual(quotaPresentation(s, now).windows.map(w => windowLabel(w)), ['周窗口'])
  assert.equal(quotaPresentation(s, now).percent, 28)
  s.codex!.buckets[0]!.windows.push({ ...weekly, id: 'secondary', windowDurationMins: 300, remainingPercent: 62 })
  assert.equal(quotaPresentation(s, now).windows.length, 2)
})

test('readout distinguishes an unknown value from an absent window and hides unusable cached percentages', () => {
  const s = state()
  s.codex!.buckets[0]!.windows[0]!.remainingPercent = null
  assert.deepEqual(quotaPresentation(s, now).windows.map(w => w.remainingPercent), [null, 28])
  s.codex!.status = 'stale'
  assert.deepEqual(quotaPresentation(s, now).windows.map(w => w.remainingPercent), [null, 28])
  for (const status of ['expired', 'forbidden', 'signed-out', 'unavailable', 'connecting'] as const) {
    s.codex!.status = status
    assert.deepEqual(quotaPresentation(s, now).windows.map(w => w.remainingPercent), [null, null])
  }
  assert.equal(s.codex!.buckets[0]!.windows[1]!.remainingPercent, 28)
})
