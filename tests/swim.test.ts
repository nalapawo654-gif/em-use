import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSwimmer, swimBounds, swimStep } from '../src/aquarium/swim.ts'
import { waterTop } from '../src/aquarium/play.ts'

function seededRandom() {
  let seed = 42
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
}
test('both fish independently explore vertically and horizontally without pointer input', () => {
  const fish = [createSwimmer(.28, .67, .2, 0), createSwimmer(.73, .72, .12, 2.7)]
  const samples = fish.map(() => [] as { x: number; y: number }[]), random = seededRandom()
  for (let frame = 0; frame < 30 * 60; frame++) fish.forEach((f, i) => {
    swimStep(f, 1 / 30, frame / 30, waterTop(68), undefined, random)
    samples[i].push({ x: f.x, y: f.y })
  })
  for (const positions of samples) {
    assert.ok(Math.max(...positions.map(p => p.y)) - Math.min(...positions.map(p => p.y)) > .20)
    assert.ok(Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x)) > .20)
  }
  assert.notDeepEqual(samples[0], samples[1])
})
test('fish remain inside their swimming bounds while quota falls to zero and refills', () => {
  const random = seededRandom()
  for (const width of [.2, .12]) {
    const fish = createSwimmer(.5, .5, width, 0)
    for (const percent of [100, 68, 22, 5, 0, 100]) {
      const top = waterTop(percent), bounds = swimBounds(top, width)
      for (let i = 0; i < 300; i++) {
        swimStep(fish, 1 / 30, i / 30, top, { x: i % 2 ? -1 : 2, y: i % 2 ? -1 : 2 }, random)
        assert.ok(fish.x >= bounds.left && fish.x <= bounds.right)
        assert.ok(fish.y >= bounds.top && fish.y <= bounds.bottom)
        assert.ok(Number.isFinite(fish.facing))
      }
    }
  }
})
