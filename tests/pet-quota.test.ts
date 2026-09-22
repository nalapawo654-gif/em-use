import test from 'node:test'
import assert from 'node:assert/strict'
import { moodFor, normalizeQuota } from '../src/shared/quota.ts'
import { petQuotaIndex, petQuotaSamples } from '../src/shared/petQuota.ts'
import { buddyLevel } from '../src/buddy/play.ts'
import { beaverLevel } from '../src/beaver/play.ts'
import { batteryLevel } from '../src/battery/play.ts'
import { hamsterLevel } from '../src/hamster/play.ts'
import { cultivationLevel } from '../src/cultivation/play.ts'

const forms = [
  ['buddy', buddyLevel, [0, 1, 2, 3], 0],
  ['beaver', beaverLevel, [0, 1, 2, 3, 4, 5], 0],
  ['battery', batteryLevel, ['full', 'bright', 'steady', 'tired', 'low', 'empty'], 'unknown'],
  ['hamster', hamsterLevel, ['full', 'working', 'low', 'empty'], 'unknown'],
  ['cultivation', cultivationLevel, ['full', 'settling', 'low', 'empty'], 'unknown'],
  ['aquarium', moodFor, ['abundant', 'normal', 'warning', 'danger'], 'abundant']
] as const
for (const [name, level, expected, unknown] of forms) {
  test(`${name}: every evenly divided form is reachable, including exact boundaries`, () => {
    const read = level as (percent: number | null) => string | number
    const count = expected.length
    assert.deepEqual(petQuotaSamples(count).map(read), expected)
    for (let index = 1; index < count; index++) {
      const boundary = 100 * (count - index) / count
      assert.equal(read(boundary + 0.001), expected[index - 1])
      assert.equal(read(boundary), expected[index])
      assert.equal(read(boundary - 0.001), expected[index])
    }
    for (const percent of [0, -1]) assert.equal(read(percent), expected[count - 1])
    assert.equal(read(101), expected[0])
    if (name !== 'aquarium') {
      for (const percent of [null, NaN, Infinity, -Infinity]) assert.equal(read(percent), unknown)
    }
    // Recovery from the last form must follow the current quota in either direction.
    assert.deepEqual([...petQuotaSamples(count)].reverse().map(read), [...expected].reverse())
  })
}
test('uniform samples support arbitrary counts without rounding away fractional boundaries', () => {
  assert.deepEqual(petQuotaSamples(4), [100, 75, 50, 25])
  assert.deepEqual(petQuotaSamples(5), [100, 80, 60, 40, 20])
  assert.deepEqual(petQuotaSamples(6), [100, 500 / 6, 400 / 6, 50, 200 / 6, 100 / 6])
  for (let count = 1; count <= 12; count++) {
    assert.deepEqual(petQuotaSamples(count).map(p => petQuotaIndex(p, count)), Array.from({length: count}, (_, i) => i))
    assert.equal(petQuotaIndex(0, count), count - 1)
    assert.equal(petQuotaIndex(null, count), null)
  }
  for (const count of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => petQuotaSamples(count), RangeError)
})

test('six-form boundaries survive amount-to-percentage normalization used by previews and accounts', () => {
  for (const [index, used] of [0, 50, 100, 150, 200, 250].entries()) {
    const quota = normalizeQuota({ code: '000200', data: { dailyCostLimit: '300', currentDayCost: String(used), currentTime: '2026-09-22T12:00:00', lastCostEstimateTime: '2026-09-22T12:00:00', quotaExceeded: false } })
    assert.equal(petQuotaIndex(quota.percent, 6), index)
    assert.equal(beaverLevel(quota.percent), index)
    assert.equal(batteryLevel(quota.percent), ['full','bright','steady','tired','low','empty'][index])
  }
})
