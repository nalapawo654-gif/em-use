import { durations, type BuddyAction } from './play'

export type BuddyExpression = 'content' | 'happy' | 'chewing' | 'drinking' | 'annoyed' | 'sleepy' | 'surprised'
export interface BuddyMotion {
  phase: 'idle' | 'prepare' | 'perform' | 'recover'
  expression: BuddyExpression
  headAngle: number; headY: number; headX: number
  bodyY: number; bodyScale: number; tailAngle: number; foot: number
  eyeOpen: number; lookX: number; lookY: number; mouth: number
  grass: number; water: number; splash: number; bugX: number; bugY: number; bugAlpha: number
}
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const x = clamp(n); return x * x * (3 - 2 * x) }
// Shared envelopes keep the animal, facial expression and props on one clock.
// The last frame returns to the same pose as idle, including when interrupted.
export function sampleBuddyMotion(action: BuddyAction, elapsed: number, clock: number, level: number, reduced = false): BuddyMotion {
  const duration = action === 'idle' || action === 'clean' ? Infinity : durations[action]
  const prepare = 850, recovery = 900
  const weight = action === 'idle' ? 0 : smooth(elapsed / prepare) * (Number.isFinite(duration) ? smooth((duration - elapsed) / recovery) : 1)
  const active = Math.max(0, elapsed - prepare), t = clock / 1000
  const blinkTime = ((clock % 4700) + 4700) % 4700
  const blink = blinkTime > 4250 && blinkTime < 4460 ? Math.sin((blinkTime - 4250) / 210 * Math.PI) : 0
  const m: BuddyMotion = {
    phase: action === 'idle' ? 'idle' : elapsed < prepare ? 'prepare' : elapsed > duration - recovery ? 'recover' : 'perform',
    expression: level > 1 ? 'sleepy' : 'content', headAngle: Math.sin(t * 1.1) * .012, headY: Math.sin(t * 1.5) * 1.1, headX: 0,
    bodyY: 0, bodyScale: 1 + Math.sin(t * 1.5) * .006, tailAngle: Math.sin(t * 1.35) * .045, foot: 0,
    eyeOpen: (1 - blink) * (level === 3 ? 0 : level > 1 ? .48 : level === 1 ? .8 : 1), lookX: Math.sin(t * .45) * .6, lookY: .15,
    mouth: 0, grass: 1, water: 1, splash: 0, bugX: 420, bugY: 170, bugAlpha: 0,
  }
  if (action === 'feed' || action === 'drink') {
    const chewing = .5 + .5 * Math.sin(active / (action === 'feed' ? 100 : 155))
    m.expression = action === 'feed' ? 'chewing' : 'drinking'
    m.headAngle -= weight * .48; m.headY += weight * (90 - [0,.07,.28,.48][Math.min(3,Math.max(0,level))] * 150); m.headX -= weight * 8
    m.headY += weight * chewing * 2; m.eyeOpen = (1 - blink) * (1 - weight * .32)
    m.lookX = -weight * 2; m.lookY = weight * 3
    m.mouth = weight * (.15 + chewing * .85)
    m.grass = 1 - clamp(active / 3400) * .85
    m.water = 1 - clamp(active / 3700) * .5
    m.splash = weight * chewing
    m.tailAngle += weight * Math.sin(t * 5) * .10
  } else if (action === 'pet' || action === 'wag' || action === 'celebrate' || action === 'clean') {
    m.expression = 'happy'; m.eyeOpen = (1 - blink) * (1 - weight * .91)
    m.headAngle += weight * (.10 + Math.sin(t * 2.7) * .035); m.headY -= weight * 5
    m.tailAngle += Math.sin(t * 8) * weight * .30; m.mouth = weight * .4
    if (action === 'clean') m.headX += Math.sin(t * 2) * weight * 3
  } else if (action === 'swat') {
    const strike = Math.exp(-(((elapsed - 2300) / 180) ** 2)) + Math.exp(-(((elapsed - 3550) / 170) ** 2))
    const escape = smooth((elapsed - 3650) / 750)
    m.expression = elapsed > 3900 ? 'happy' : 'annoyed'
    m.lookX = weight * 3; m.lookY = -weight * 1.5
    m.headAngle += weight * .12 - strike * .07
    m.tailAngle += weight * Math.sin(t * 6) * .1 - strike * 1.05
    m.bodyY -= strike * 3; m.eyeOpen = (1 - blink) * (.72 + strike * .28)
    m.bugX = 408 + Math.sin(elapsed / 220) * 19 + escape * 180
    m.bugY = 242 + Math.cos(elapsed / 175) * 24 - escape * 170
    m.bugAlpha = smooth(elapsed / 350) * (1 - escape); m.mouth = strike * .4
  } else if (action === 'sleep' || action === 'rest') {
    m.expression = 'sleepy'; m.eyeOpen *= 1 - weight; m.headAngle -= weight * .13
    m.headY += weight * (22 + Math.sin(t * 1.3) * 2); m.mouth = action === 'sleep' ? weight * .12 : 0
    m.tailAngle *= 1 - weight
  } else if (action === 'play') {
    const kick = Math.exp(-(((elapsed - 1450) / 220) ** 2)) + Math.exp(-(((elapsed - 3650) / 220) ** 2))
    m.expression = 'happy'; m.foot = kick * .5; m.headAngle -= kick * .08
    m.headY -= kick * 5; m.lookY = weight * 3; m.mouth = weight * .3
    m.tailAngle += Math.sin(t * 7) * weight * .20
  } else if (action === 'shake') {
    m.expression = 'surprised'; m.headAngle += Math.sin(t * 22) * weight * .1
    m.headX += Math.sin(t * 22) * weight * 4; m.tailAngle += Math.sin(t * 18 - .8) * weight * .24
    m.mouth = weight * .45
  } else if (action === 'inflate') {
    m.expression = 'surprised'; m.bodyScale += weight * (.025 + Math.sin(t * 5) * .012)
    m.headY -= weight * 5; m.mouth = weight * .6; m.eyeOpen = 1 - blink
  }
  if (reduced) return { ...m, phase: action === 'idle' ? 'idle' : 'perform', headAngle: 0, headX: 0, headY: 0, bodyY: 0, bodyScale: 1, tailAngle: 0, foot: 0, mouth: action === 'idle' ? 0 : .2, eyeOpen: ['sleep','rest'].includes(action) ? 0 : 1, splash: 0 }
  return m
}
