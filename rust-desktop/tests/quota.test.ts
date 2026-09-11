import { test } from 'node:test'
import assert from 'node:assert/strict'
import { captureHeaders, normalizeQuota, QuotaError, beijingDay, millisecondsToMidnight, moodFor, quotaFreshness } from '../src/shared/quota.ts'
const now = Date.parse('2026-09-09T16:57:17+08:00')
const fixture = (data: Record<string, unknown> = {}) => ({ code: '000200', data: { dailyCostLimit: '300.0000', currentDayCost: '122.58', currentTime: '2026-09-09T16:57:17.686637', lastCostEstimateTime: '2026-09-09T16:54:59', quotaExceeded: false, ...data } })
test('normalizes observed gateway contract without confusing cost and tokens', () => {
  const quota = normalizeQuota(fixture(), now)
  assert.equal(quota.remaining, 177.42); assert.ok(Math.abs(quota.percent - 59.14) < 1e-9); assert.equal(quota.day, '2026-09-09')
  assert.equal(quotaFreshness(quota, now), 'ready')
})
test('uses server allowance, including changes to daily plan', () => {
  const q = normalizeQuota(fixture({ dailyCostLimit: '500.00' }), now)
  assert.equal(q.remaining, 377.42)
})
test('exceeded allowance does not create negative water level', () => {
  const q = normalizeQuota(fixture({ currentDayCost: '350.75' }), now)
  assert.equal(q.remaining, 0); assert.equal(q.percent, 0); assert.equal(q.exceeded, true); assert.equal(q.used, 350.75)
})
test('zero, absent and malformed amounts are unavailable, never 100%', () => {
  for (const value of [0, '0', '', null, undefined, 'NaN', -3, 'abc', Infinity]) {
    assert.throws(() => normalizeQuota(fixture({ dailyCostLimit: value }), now), QuotaError)
  }
  for (const value of ['', null, undefined, '-1', NaN]) assert.throws(() => normalizeQuota(fixture({ currentDayCost: value }), now), QuotaError)
})
test('business errors are distinct from success with empty data', () => {
  assert.throws(() => normalizeQuota({ code: '000401' }, now), (e: unknown) => e instanceof QuotaError && e.kind === 'expired')
  assert.throws(() => normalizeQuota({ code: '000403' }, now), (e: unknown) => e instanceof QuotaError && e.kind === 'forbidden')
  assert.throws(() => normalizeQuota({ code: '000200', data: {} }, now), QuotaError)
})
test('reaching midnight does not invent a full allowance', () => {
  const midnight = Date.parse('2026-09-10T00:00:02+08:00')
  const q = normalizeQuota(fixture({ currentTime: '2026-09-10T00:00:02', lastCostEstimateTime: '2026-09-09T23:59:59' }), midnight)
  assert.equal(quotaFreshness(q, midnight), 'resetting'); assert.equal(q.remaining, 177.42)
})
test('server-confirmed next day activates new allowance', () => {
  const midnight = Date.parse('2026-09-10T00:05:10+08:00')
  const q = normalizeQuota(fixture({ currentTime: '2026-09-10T00:05:10', lastCostEstimateTime: '2026-09-10T00:04:59', currentDayCost: '0.24' }), midnight)
  assert.equal(quotaFreshness(q, midnight), 'ready'); assert.equal(q.remaining, 299.76)
})
test('Beijing reset does not depend on OS time zone', () => {
  assert.equal(beijingDay(Date.parse('2026-09-09T16:00:00Z')), '2026-09-10')
  assert.equal(millisecondsToMidnight(Date.parse('2026-09-09T15:59:50Z')), 10000)
})
test('old fee estimates and disconnected snapshots become stale', () => {
  assert.equal(quotaFreshness(normalizeQuota(fixture({ lastCostEstimateTime: '2026-09-09T16:30:00' }), now), now), 'stale')
  assert.equal(quotaFreshness(normalizeQuota(fixture(), now), now + 4 * 60000), 'stale')
})
test('unparseable or future estimate times cannot appear synchronized', () => {
  for (const lastCostEstimateTime of [null, '', 'oops', '2026-09-10T16:54:59']) assert.throws(() => normalizeQuota(fixture({ lastCostEstimateTime }), now), QuotaError)
})
test('header names are case insensitive; all three complete values required', () => {
  const auth = captureHeaders({ 'x-dong-auth': 'test-auth', 'X-Dong-User': 'test-user', 'x-Dong-client': 'WEB-test', Cookie: 'must-not-capture' })
  assert.deepEqual(auth, { 'X-Dong-Auth': 'test-auth', 'X-Dong-User': 'test-user', 'X-Dong-Client': 'WEB-test' })
  assert.equal(captureHeaders({ 'X-Dong-Auth': 'test-auth' }), null)
  assert.equal(captureHeaders({ ...auth!, 'X-Dong-Client': 'bad\r\nheader' }), null)
})
test('mood threshold boundaries are exhaustive', () => {
  assert.deepEqual([100, 60, 30, 10, 0].map(moodFor), ['abundant', 'normal', 'warning', 'danger', 'danger'])
})
