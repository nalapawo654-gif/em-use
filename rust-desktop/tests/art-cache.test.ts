import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LruCache } from '../src/shared/lruCache'
import { lazyFrameUrls } from '../src/evolution/frameUrls'

test('recently used artwork stays cached and eviction leaves active references intact', () => {
  const cache = new LruCache<string, { pixels: number[] }>(2)
  const active = { pixels: [1, 2, 3] }
  cache.set('a', active).set('b', { pixels: [4] })
  assert.equal(cache.get('a'), active)
  cache.set('c', { pixels: [5] })
  assert.equal(cache.get('b'), undefined)
  assert.equal(cache.size, 2)
  cache.set('d', { pixels: [6] })
  assert.equal(cache.get('a'), undefined)
  assert.deepEqual(active.pixels, [1, 2, 3])
})

test('concurrent requests share one pending entry and failed entries can be retried', async () => {
  const cache = new LruCache<string, Promise<number>>(2)
  const pending = Promise.resolve(7)
  cache.set('art', pending)
  assert.equal(cache.get('art'), pending)
  assert.equal(await cache.get('art'), 7)
  cache.delete('art'); cache.set('art', Promise.resolve(8))
  assert.equal(await cache.get('art'), 8)
})

test('frame URLs allocate no PNG strings until requested and encode each pose once', () => {
  const calls = [0, 0, 0]
  const urls = lazyFrameUrls(calls.map((_, i) => ({ toDataURL: () => { calls[i]++; return `pose-${i}` } })))
  assert.equal(urls.length, 3)
  assert.deepEqual(calls, [0, 0, 0])
  assert.equal(urls[1], 'pose-1'); assert.equal(urls[1], 'pose-1')
  assert.deepEqual(calls, [0, 1, 0])
  assert.deepEqual([...urls], ['pose-0', 'pose-1', 'pose-2'])
  assert.deepEqual(calls, [1, 1, 1])
})
