import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { REDUCED_MEDIA } from '../vite.config.js'

const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? walk(p) : [p] })

test('every CSS reduced-motion media block is neutralised by the build rule', () => {
  let blocks = 0
  for (const file of walk('src').filter(f => /\.(css|vue)$/.test(f))) {
    const text = readFileSync(file, 'utf8')
    const found = text.match(/@media[^{]*prefers-reduced-motion[^{]*/g) ?? []
    for (const media of found) { blocks++; assert.ok(new RegExp(REDUCED_MEDIA.source, 'i').test(media), `${file}: ${media.trim()}`) }
  }
  assert.ok(blocks > 0)
})

test('both entries load the motion policy before anything else', () => {
  assert.match(readFileSync('src/bootstrap.ts', 'utf8'), /^import '\.\/motionPolicy'/)
  assert.match(readFileSync('src/worlds/host.ts', 'utf8'), /^import '\.\.\/motionPolicy'/)
})
