import test from 'node:test'
import assert from 'node:assert/strict'
import { cultivatorVertex } from '../src/cultivation/motion.ts'

test('all poses pin the face, torso and seated baseline throughout the motion cycle', () => {
  for (let frame = 0; frame < 6; frame++) for (let t = 0; t <= 10; t += .125) {
    for (const [x, y] of [[.5,.12],[.4,.35],[.6,.42],[.5,.65],[.5,.8],[.15,.9],[.5,.97],[.85,.9]]) {
      assert.deepEqual(cultivatorVertex(x,y,frame,t), [x,y])
    }
  }
})

test('forearms move locally without enlarging the silhouette or drifting at the canvas edges', () => {
  for (const frame of [0,4,5]) {
    const point = cultivatorVertex(.2,.7,frame,1)
    assert.ok(Math.hypot(point[0]-.2, point[1]-.7) > .001)
    for(let y=0;y<=24;y++)for(let x=0;x<=24;x++)for(const t of [0,1,2.5,4,6]) {
      const u=x/24,v=y/24,[a,b]=cultivatorVertex(u,v,frame,t)
      assert.ok(Math.hypot(a-u,b-v)<.012, 'sleeve motion stays below 1.2% of the actor width')
      assert.ok(a>=0 && a<=1 && b>=0 && b<=1)
      const still=cultivatorVertex(u,v,frame,t,0)
      assert.ok(Math.hypot(still[0]-u,still[1]-v)<1e-15)
    }
  }
})
