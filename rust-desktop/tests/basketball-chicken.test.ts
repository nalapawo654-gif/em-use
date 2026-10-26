import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chickenFrame, chickenMotion } from '../src/basketball/chicken'

test('gameplay animations stay in populated atlas cells, including long sessions', () => {
  const populated = [6, 8, 8, 4, 5, 8, 6, 6, 6]
  for (const pose of ['idle', 'aim', 'shoot', 'celebrate', 'wave', 'miss', 'unknown']) {
    const { row } = chickenMotion(pose)
    for (const time of [-1, 0, 119, 120, 479, 480, 599, 600, 959, 960, 3600000]) {
      for (const gentle of [false, true]) {
        const frame = chickenFrame(pose, time, gentle)
        assert.ok(frame >= 0 && frame < populated[row]!, `${pose}/${time}/${gentle}`)
      }
    }
  }
})
test('short reactions stop on the final frame; gentle mode keeps a meaningful static pose', () => {
  for (const pose of ['shoot', 'miss']) {
    assert.equal(chickenFrame(pose, 1200), chickenFrame(pose, 60000))
    assert.equal(chickenFrame(pose, 1200), chickenMotion(pose).frames - 1)
  }
  for (const pose of ['idle', 'aim', 'wave', 'celebrate']) {
    assert.equal(chickenFrame(pose, 0, true), chickenFrame(pose, 1200, true))
  }
  assert.equal(chickenFrame('wave', 0, true), 2)
  assert.equal(chickenFrame('idle', 720), 0)
})
