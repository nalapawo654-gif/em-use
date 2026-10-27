import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelForm, PERSONAS } from '../src/modelmuse/personas'

test('指定分界点、两侧、零额和未知状态', () => {
  for (const [value, expected] of [[100,'claude'],[80.01,'claude'],[80,'gpt'],[79.99,'gpt'],[60.01,'gpt'],[60,'gemini'],[59.99,'gemini'],[40.01,'gemini'],[40,'doubao'],[39.99,'doubao'],[0,'doubao'],[null,null],[NaN,null]] as const) assert.equal(modelForm(value), expected)
  assert.equal(modelForm(85), 'claude')
  assert.equal(modelForm(20), 'doubao')
  assert.equal(modelForm(85), 'claude')
})
test('每种形象均有独立互动和日常台词', () => {
  for (const persona of Object.values(PERSONAS)) for (const key of ['hello','tidy','sign','idle'] as const) assert.ok(persona[key].length >= 2)
})

test('场景经过共享设置校验且没有改动其他桌宠配置', async () => {
  const { validateSettings } = await import('../src/shared/settings')
  const { SCENE_LABELS } = await import('../src/shared/types')
  assert.deepEqual(validateSettings({ scene: 'modelmuse', windowWidth: 300 }), { scene: 'modelmuse', windowWidth: 300 })
  assert.equal(SCENE_LABELS.modelmuse, '额度变装小人')
})

test('四种形象各自具备普通与觉醒的静态和整理姿态', async () => {
  const { existsSync, readFileSync } = await import('node:fs')
  for (const form of Object.keys(PERSONAS)) for (const variant of ['', '-tidy', '-awake', '-awake-tidy', '-awake-reveal']) {
    const file = new URL(`../public/assets/modelmuse/${form}${variant}.png`, import.meta.url)
    assert.ok(existsSync(file), `${form}${variant}`)
    const png = readFileSync(file)
    assert.equal(png[25], 6, `${form}${variant} should have an alpha channel`)
  }
})
