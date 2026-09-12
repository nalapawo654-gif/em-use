import type { SkadiAction } from './play'
// Local deformations are deliberately small; face and torso remain stable.
export function skadiVertex(x: number, y: number, t: number, action: SkadiAction): [number, number] {
  const edge = Math.max(0, Math.min(1, (Math.abs(x-.5)-.14)/.2))
  const hair = Math.sin(Math.PI*Math.max(0,Math.min(1,(y-.18)/.75)))
  let dx = edge * hair * Math.sin(t*1.35+y*5) * .008, dy=0
  if(action==='walk'){
    const lower=Math.max(0,(y-.69)/.31),side=x<.5?-1:1
    dx+=Math.sin(t*9)*lower*.012*side
    dy+=Math.sin(t*9+side*Math.PI/2)*lower*.012
  }
  if(action==='wave'){
    const hand=Math.exp(-((x-.3)**2/.026+(y-.46)**2/.012))
    dx+=hand*Math.sin(t*9)*.016;dy-=hand*(1+Math.sin(t*9))*.009
  }
  return [x+dx,y+dy]
}
