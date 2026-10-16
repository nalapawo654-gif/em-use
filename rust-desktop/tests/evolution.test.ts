import { evolutionAppearance } from '../src/evolution/appearance.js'
import { DEFAULT_SETTINGS } from '../src/shared/types.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialEvolution, stepEvolution, type EvolutionInput } from '../src/evolution/state.js'
const base: EvolutionInput = { source:'eastmoney', scene:'potato', enabled:true, ready:true, retain:true, blocked:false, hidden:false, motion:'full' }
const start = () => stepEvolution(initialEvolution(), base, 0)
test('startup and refresh settle without ceremony; scene selection animates', () => {
  let s = stepEvolution(initialEvolution(), {...base, source:'codex'}, 0)
  assert.equal(s.awake,true); assert.equal(s.phase,'idle')
  s = stepEvolution(s, {...base, source:'codex'}, 100)
  assert.equal(s.phase,'idle')
  s = stepEvolution(s, {...base, source:'codex',scene:'fox'},200)
  assert.equal(s.phase,'unfold'); assert.equal(s.pending,false)
})
test('explicit source change follows 1.6 second transformation', () => {
  const input = {...base,source:'codex'}
  let s=stepEvolution(start(),input,100)
  assert.equal(s.phase,'gather'); assert.equal(s.awake,false)
  s=stepEvolution(s,input,400); assert.equal(s.phase,'unfold'); assert.equal(s.awake,true)
  s=stepEvolution(s,input,900); assert.equal(s.phase,'reveal')
  s=stepEvolution(s,input,1400); assert.equal(s.phase,'settle')
  s=stepEvolution(s,input,1700); assert.equal(s.phase,'idle'); assert.equal(s.awake,true)
})
test('busy interaction defers until release and hidden cancels ceremony',()=>{
  let s=stepEvolution(start(),{...base,source:'codex',blocked:true},10)
  assert.equal(s.pending,true); assert.equal(s.awake,false)
  s=stepEvolution(s,{...base,source:'codex'},200); assert.equal(s.phase,'gather')
  s=stepEvolution(s,{...base,source:'codex',hidden:true},300)
  assert.equal(s.phase,'idle'); assert.equal(s.pending,false); assert.equal(s.awake,true)
})
test('unknown quota waits, stale retains form, signout removes it',()=>{
  let s=stepEvolution(start(),{...base,source:'codex',ready:false,retain:false},10)
  assert.equal(s.pending,true); assert.equal(s.awake,false)
  s=stepEvolution(s,{...base,source:'codex'},100)
  s=stepEvolution(s,{...base,source:'codex'},1800)
  s=stepEvolution(s,{...base,source:'codex',ready:false},1900)
  assert.equal(s.awake,true); assert.equal(s.phase,'idle')
  s=stepEvolution(s,{...base,source:'codex',ready:false,retain:false},2000)
  assert.equal(s.awake,false); assert.equal(s.phase,'idle')
})
test('rapid reversal cannot leave residual ceremony',()=>{
  let s=stepEvolution(start(),{...base,source:'codex'},10)
  s=stepEvolution(s,base,20)
  assert.equal(s.awake,false); assert.equal(s.pending,false); assert.equal(s.phase,'idle')
})
test('return completes in 600 ms and motion off settles immediately',()=>{
  let s=stepEvolution(initialEvolution(),{...base,source:'codex'},0)
  s=stepEvolution(s,base,100); assert.equal(s.phase,'return')
  s=stepEvolution(s,base,700); assert.equal(s.awake,false); assert.equal(s.phase,'idle')
  s=stepEvolution(s,{...base,source:'codex',motion:'off'},800)
  assert.equal(s.awake,true); assert.equal(s.phase,'idle')
})
test('light mode settles in 200 ms and interruption clears effect',()=>{
  let s=stepEvolution(start(),{...base,source:'codex',motion:'light'},10)
  assert.equal(s.awake,true)
  s=stepEvolution(s,{...base,source:'codex',motion:'light'},210); assert.equal(s.phase,'idle')
  s=stepEvolution(s,base,220)
  s=stepEvolution(s,{...base,blocked:true},230)
  assert.equal(s.phase,'idle'); assert.equal(s.awake,false)
})

test('wardrobe changes coalesce while blocked, even without Codex',()=>{
  let s=stepEvolution(start(),{...base,appearance:'potato/knight',blocked:true},10)
  assert.equal(s.pending,true); assert.equal(s.phase,'idle')
  s=stepEvolution(s,{...base,appearance:'potato/astronaut',blocked:true},20)
  s=stepEvolution(s,{...base,appearance:'potato/astronaut'},30)
  assert.equal(s.phase,'unfold'); assert.equal(s.awake,false)
  s=stepEvolution(s,{...base,appearance:'potato/astronaut'},830)
  assert.equal(s.phase,'idle'); assert.equal(s.pending,false)
})
test('a cold costume waits before starting the source ceremony',()=>{
  const input={...base,source:'codex'}
  let s=stepEvolution(start(),{...input,assetsReady:false},10)
  assert.equal(s.phase,'idle'); assert.equal(s.pending,true); assert.equal(s.awake,false)
  s=stepEvolution(s,{...input,assetsReady:false},3000)
  assert.equal(s.phase,'idle')
  s=stepEvolution(s,input,3100)
  assert.equal(s.phase,'gather'); assert.equal(s.started,3100)
  s=stepEvolution(s,input,3400)
  assert.equal(s.phase,'unfold'); assert.equal(s.awake,true)
})
test('costume switches restart, refresh does not; hidden and off cancel pending',()=>{
  let s=stepEvolution(start(),{...base,appearance:'potato/knight'},10)
  s=stepEvolution(s,{...base,appearance:'potato/astronaut'},30)
  assert.equal(s.started,30)
  s=stepEvolution(s,{...base,appearance:'potato/astronaut'},60)
  assert.equal(s.started,30)
  s=stepEvolution(s,{...base,appearance:'potato/knight',blocked:true},100)
  s=stepEvolution(s,{...base,appearance:'potato/knight',hidden:true},110)
  assert.equal(s.phase,'idle'); assert.equal(s.pending,false)
  s=stepEvolution(s,{...base,appearance:'potato/astronaut',motion:'off'},120)
  assert.equal(s.phase,'idle'); assert.equal(s.pending,false)
})
test('return swaps to original during the fade, not after it',()=>{
  let s=stepEvolution(initialEvolution(),{...base,source:'codex'},0)
  s=stepEvolution(s,base,100)
  assert.equal(s.phase,'return'); assert.equal(s.awake,true)
  s=stepEvolution(s,base,400)
  assert.equal(s.phase,'reveal'); assert.equal(s.awake,false)
})

test('appearance identity follows only the selected pet and Skadi form',()=>{
  const settings={...DEFAULT_SETTINGS,scene:'skadi' as const}
  const original=evolutionAppearance(settings)
  assert.equal(evolutionAppearance({...settings,foxSkin:'jade'}),original)
  assert.equal(evolutionAppearance({...settings,skadiAdultSkin:'azure'}),original)
  assert.notEqual(evolutionAppearance({...settings,skadiSkin:'azure'}),original)
  assert.notEqual(evolutionAppearance({...settings,skadiForm:'adult'}),original)
})

test('awakened dinosaur wardrobe reserves the full authored storyboard duration',()=>{
  let s=stepEvolution(initialEvolution(),{...base,source:'codex',scene:'dinosaur',appearance:'dinosaur/classic'},0)
  s=stepEvolution(s,{...base,source:'codex',scene:'dinosaur',appearance:'dinosaur/peach'},100)
  assert.equal(s.duration,1600)
  s=stepEvolution(s,{...base,source:'codex',scene:'dinosaur',appearance:'dinosaur/peach'},1700)
  assert.equal(s.phase,'idle');assert.equal(s.awake,true)
})

test('enabling reduced motion during a ceremony shortens its remaining lifetime',()=>{
 let s=stepEvolution(start(),{...base,source:'codex'},100)
 s=stepEvolution(s,{...base,source:'codex',motion:'light'},200)
 assert.equal(s.duration,200);assert.equal(s.started,200);assert.equal(s.awake,true)
 s=stepEvolution(s,{...base,source:'codex',motion:'light'},400)
 assert.equal(s.phase,'idle')
})
