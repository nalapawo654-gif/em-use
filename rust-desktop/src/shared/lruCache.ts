/** Eviction drops only the cache reference; active renderers keep valid assets. */
export class LruCache<K, V> {
  private entries = new Map<K, V>()
  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Cache capacity must be positive')
  }
  get size() { return this.entries.size }
  get(key: K): V | undefined {
    const value = this.entries.get(key)
    if (this.entries.has(key)) { this.entries.delete(key); this.entries.set(key, value!) }
    return value
  }
  set(key: K, value: V) {
    this.entries.delete(key); this.entries.set(key, value)
    while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!)
    return this
  }
  delete(key: K) { return this.entries.delete(key) }
}
