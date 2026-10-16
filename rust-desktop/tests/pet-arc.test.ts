import test from 'node:test'
import assert from 'node:assert/strict'
import { arcButtonStyle } from '../src/shared/petArc.ts'

const num = (value: string) => parseFloat(value)
const corners = (s: ReturnType<typeof arcButtonStyle>) => [num(s.left), num(s.top), num(s.width), num(s.height)]

test('standard and mini arc hit areas stay inside the square and labels stay inside each button', () => {
  for (const [count, start, end] of [[4,-76,-28],[5,-76,-28],[3,-28,40],[4,-28,40],[4,-76,40],[5,-76,40]]) {
    for (let i = 0; i < count!; i++) {
      const s = arcButtonStyle(i,count!,start!,end!, {start:i===0,end:i===count!-1}), [x,y,w,h] = corners(s)
      assert.ok(x! >= 0 && y! >= 0 && x! + w! <= 100 && y! + h! <= 100)
      assert.ok(num(s['--content-x']) > 0 && num(s['--content-x']) < 100)
      assert.ok(num(s['--content-y']) > 0 && num(s['--content-y']) < 100)
    }
  }
})
test('mini management targets remain at least 24px in both dimensions at minimum window width', () => {
  for (const count of [4,5]) for (let i=0;i<count;i++) {
    const s=arcButtonStyle(i,count,-76,40,{start:i===0,end:i===count-1})
    assert.ok(num(s.width)*1.8 >= 24, `button ${i}/${count} width`)
    assert.ok(num(s.height)*1.8 >= 24, `button ${i}/${count} height`)
  }
})
test('invalid geometry is rejected instead of emitting NaN CSS', () => {
  assert.throws(()=>arcButtonStyle(0,0,-76,40),RangeError)
  assert.throws(()=>arcButtonStyle(5,4,-76,40),RangeError)
  assert.throws(()=>arcButtonStyle(0,4,50,-76),RangeError)
})
