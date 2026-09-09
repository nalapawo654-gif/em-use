import test from 'node:test'
import assert from 'node:assert/strict'
import { fitBowl, gestureBounds } from '../src/shared/windowGeometry'
const area = { x: 0, y: 0, width: 1440, height: 900 }, start = { x: 200, y: 200, width: 300, height: 300 }
test('resize keeps the opposite corner fixed and the bowl square', () => {
  assert.deepEqual(gestureBounds(start, 100, 100, 'se', area), { x: 200, y: 200, width: 400, height: 400 })
  assert.deepEqual(gestureBounds(start, -100, -100, 'nw', area), { x: 100, y: 100, width: 400, height: 400 })
  assert.deepEqual(gestureBounds(start, 100, -100, 'ne', area), { x: 200, y: 100, width: 400, height: 400 })
  assert.deepEqual(gestureBounds(start, -100, 100, 'sw', area), { x: 100, y: 200, width: 400, height: 400 })
})
test('resize clamps to readable minimum and available display space', () => {
  assert.equal(gestureBounds(start, -900, -900, 'se', area).width, 180)
  assert.deepEqual(gestureBounds(start, -900, -900, 'nw', area), { x: 0, y: 0, width: 500, height: 500 })
  assert.equal(fitBowl({ ...start, width: 900 }, area).width, 800)
})
test('movement supports negative display coordinates and clamps edges', () => {
  const left = { x: -1920, y: -100, width: 1920, height: 1080 }
  assert.deepEqual(gestureBounds(start, -900, 0, 'move', left), { x: -700, y: 200, width: 300, height: 300 })
  assert.deepEqual(gestureBounds(start, -9999, -9999, 'move', left), { x: -1920, y: -100, width: 300, height: 300 })
})
test('small display does not strand an oversized window', () => {
  assert.deepEqual(fitBowl(start, { x: 0, y: 0, width: 150, height: 170 }), { x: 0, y: 20, width: 150, height: 150 })
})
