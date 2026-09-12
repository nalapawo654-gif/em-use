import test from 'node:test'
import assert from 'node:assert/strict'
import { moodFor } from '../src/shared/quota.ts'
import { buddyLevel } from '../src/buddy/play.ts'
import { beaverLevel } from '../src/beaver/play.ts'
import { batteryLevel } from '../src/battery/play.ts'
import { hamsterLevel } from '../src/hamster/play.ts'
import { cultivationLevel } from '../src/cultivation/play.ts'

const forms = [
  ['buddy', buddyLevel, 3, 0],
  ['beaver', beaverLevel, 5, 0],
  ['battery', batteryLevel, 'empty', 'unknown'],
  ['hamster', hamsterLevel, 'empty', 'unknown'],
  ['cultivation', cultivationLevel, 'empty', 'unknown']
] as const
for (const [name, level, final, unknown] of forms) {
  test(`${name}: final form starts at 15%, retaining unknown and preceding forms`, () => {
    for (const percent of [15, 14.99, 10, 1, 0, -1]) assert.equal(level(percent), final)
    for (const percent of [15.01, 16, 20, 50, 100]) assert.notEqual(level(percent), final)
    for (const percent of [null, NaN, Infinity, -Infinity]) assert.equal(level(percent), unknown)
  })
}
test('aquarium final mood starts at 15%', () => {
  assert.equal(moodFor(15.01), 'warning')
  for (const percent of [15, 10, 0]) assert.equal(moodFor(percent), 'danger')
})
