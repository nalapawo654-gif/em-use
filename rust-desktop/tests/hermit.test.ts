import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { beginHermit, advanceHermit, catchFeather, hermitFrame, hermitIdle, inCatchZone } from '../src/hermit/play'
import { validateSettings } from '../src/shared/settings'
import { DEFAULT_SETTINGS } from '../src/shared/types'
import { evolutionAppearance } from '../src/evolution/appearance'
import { stepEvolution, initialEvolution } from '../src/evolution/state'
import { transformationEndFrame } from '../src/evolution/transformation'
import normal from '../src/hermit/atlas.json'
import awake from '../src/evolution/atlas-manifest.json'
import transform from '../src/evolution/transformation-manifest.json'

test('羽毛必须三次有效独立抓取，取消和重入不继承进度', () => {
  let p = beginHermit('tease', 0)
  assert.equal(catchFeather(p, 100, false).catches, 0)
  p = catchFeather(p, 100, true)
  assert.equal(catchFeather(p, 101, true).catches, 1)
  p = catchFeather(p, 500, true); p = catchFeather(p, 900, true)
  assert.equal(p.catches, 3)
  assert.equal(catchFeather(p, 1400, true).catches, 3)
  assert.equal(advanceHermit(p, 1899).action, 'tease')
  assert.equal(advanceHermit(p, 1900).action, 'idle')
  assert.equal(beginHermit('tease', 2000).catches, 0)
  assert.equal(catchFeather(hermitIdle(), 3000, true).catches, 0)
  assert.ok(inCatchZone(.65, .43)); assert.ok(!inCatchZone(0, 0)); assert.ok(!inCatchZone(NaN, .43))
})
test('零额、未知与主动休息不伪装成满额；短动作结束回真实姿态', () => {
  assert.equal(hermitFrame(0, hermitIdle(), 0), 3)
  assert.equal(hermitFrame(null, hermitIdle(), 0), 1)
  assert.equal(hermitFrame(NaN, hermitIdle(), 0), 1)
  assert.equal(transformationEndFrame('hermit', 0, 6), 3)
  assert.equal(transformationEndFrame('hermit', null, 6), 1)
  const sleep = beginHermit('sleep', 0)
  assert.equal(advanceHermit(sleep, 999999).action, 'sleep')
  assert.equal(hermitFrame(100, sleep, 999999), 3)
  const end = advanceHermit(beginHermit('knock', 0), 1500)
  assert.equal(hermitFrame(0, end, 1500), 3)
})
test('换源不丢装饰；只有当前住处改变才参与觉醒签名', () => {
  assert.deepEqual(validateSettings({ scene: 'hermit', hermitSkin: 'castle', hermitAccessory: 'leaf', hermitProp: 'sign' }), { scene: 'hermit', hermitSkin: 'castle', hermitAccessory: 'leaf', hermitProp: 'sign' })
  assert.deepEqual(validateSettings({ hermitSkin: 'fake', hermitAccessory: 'fake', hermitProp: 'fake' }), {})
  const settings = { ...DEFAULT_SETTINGS, scene: 'hermit' as const }
  assert.equal(evolutionAppearance(settings), 'hermit/box')
  assert.equal(evolutionAppearance({ ...settings, hermitAccessory: 'bag' }), 'hermit/box')
  assert.equal(evolutionAppearance({ ...settings, hermitSkin: 'soda' }), 'hermit/soda')
})
test('寄居蟹宅家期间排队变身，唤醒后开始，隐藏可清理', () => {
  const input = { source: 'eastmoney', scene: 'hermit', appearance: 'hermit/box', enabled: true, ready: true, retain: true, assetsReady: true, blocked: false, hidden: false, motion: 'full' as const }
  let state = stepEvolution(initialEvolution(), input, 0)
  state = stepEvolution(state, { ...input, source: 'codex', blocked: true }, 10)
  assert.ok(state.pending); assert.equal(state.phase, 'idle')
  state = stepEvolution(state, { ...input, source: 'codex' }, 100)
  assert.equal(state.phase, 'gather'); assert.equal(state.duration, 1600)
  state = stepEvolution(state, { ...input, source: 'codex', hidden: true }, 400)
  assert.equal(state.phase, 'idle'); assert.ok(!state.pending); assert.ok(state.awake)
})
test('三套原始、觉醒、变身图集都存在，六帧边界不越界', () => {
  for (const skin of ['box', 'soda', 'castle'] as const) {
    for (const [spec, folder] of [[normal.normal[skin], 'hermit'], [awake[`hermit/${skin}`], 'evolution/v2'], [transform[`hermit/${skin}`], 'evolution/v3']] as const) {
      assert.equal(spec.rects.length, 6)
      const bytes = readFileSync(new URL(`../public/assets/${folder}/${spec.file}`, import.meta.url))
      assert.equal(bytes.readUInt32BE(16), spec.size[0]); assert.equal(bytes.readUInt32BE(20), spec.size[1])
      for (const [x,y,w,h] of spec.rects) { assert.ok(x! >= 0 && y! >= 0 && w! > 0 && h! > 0); assert.ok(x! + w! <= spec.size[0]! && y! + h! <= spec.size[1]!) }
    }
  }
})
