import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { IDLE_BUSY, IDLE_FLOURISHES, nextIdleDelay, pickFlourish } from '../src/shared/petIdle.js'

test('every idle pet owns a distinct flourish set that starts and ends at rest', () => {
  const seen = new Map<string, string>()
  for (const [scene, list] of Object.entries(IDLE_FLOURISHES)) {
    assert.ok(list.length >= 2, `${scene} needs at least two flourishes`)
    for (const item of list) {
      assert.ok(item.duration >= 600 && item.duration <= 4000, `${scene}/${item.name} duration`)
      assert.equal(item.frames[0]!.offset, 0); assert.equal(item.frames.at(-1)!.offset, 1)
      assert.equal(item.frames[0]!.transform, item.frames.at(-1)!.transform)
      const offsets = item.frames.map(f => f.offset as number)
      assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b), `${scene}/${item.name} offsets ascend`)
      seen.set(`${scene}/${item.name}`, scene)
    }
  }
  assert.equal(seen.size, Object.values(IDLE_FLOURISHES).flat().length)
})

test('flourish picking avoids immediate repeats and delays stay in range', () => {
  const list = IDLE_FLOURISHES.buddy
  for (let i = 0; i < 50; i++) assert.notEqual(pickFlourish(list, 'puff', Math.random).name, 'puff')
  assert.equal(pickFlourish([list[0]!], list[0]!.name).name, list[0]!.name)
  assert.ok(nextIdleDelay(true, () => 0) >= 3500 && nextIdleDelay(true, () => .999) < 7000)
  assert.ok(nextIdleDelay(false, () => 0) >= 7000 && nextIdleDelay(false, () => .999) < 16000)
})

test('busy states block flourishes; training remains a free daily state', () => {
  for (const cls of ['.has-panel', '.has-action', '.is-moving', '.calendar-is-open', '.has-notice']) assert.ok(IDLE_BUSY.includes(cls))
  assert.ok(!IDLE_BUSY.includes('.is-training'))
})

test('idle scheduler is mounted inside each pet without autonomous motion', () => {
  const files: Record<string, string> = { aquarium: 'src/App.vue', buddy: 'src/components/BuddyExperience.vue', beaver: 'src/components/BeaverExperience.vue', cultivation: 'src/components/CultivationExperience.vue', battery: 'src/components/BatteryExperience.vue', hamster: 'src/components/HamsterExperience.vue', hermit: 'src/components/HermitExperience.vue', piranha: 'src/components/PiranhaExperience.vue', potato: 'src/components/PotatoExperience.vue', basketball: 'src/components/BasketballExperience.vue' }
  assert.deepEqual(Object.keys(files).sort(), Object.keys(IDLE_FLOURISHES).sort())
  for (const [scene, file] of Object.entries(files)) assert.match(readFileSync(file, 'utf8'), new RegExp(`<PetIdle scene="${scene}"/>`))
})
