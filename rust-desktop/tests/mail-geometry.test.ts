import { test } from 'node:test'
import assert from 'node:assert/strict'
import { containMailRect } from '../src/shared/mailGeometry'

test('portrait cup preserves its ratio and floor baseline in awakened mail placement', () => {
  const box = { x: 320, y: 305, width: 100, height: 140 }
  for (const [width, height] of [[119, 166], [200, 350], [180, 120]]) {
    const rect = containMailRect(width!, height!, box)
    assert.ok(Math.abs(rect.width / rect.height - width! / height!) < 1e-10)
    assert.equal(rect.y + rect.height, box.y + box.height)
    assert.equal(rect.x + rect.width / 2, box.x + box.width / 2)
    assert.ok(rect.width <= box.width && rect.height <= box.height)
  }
})
