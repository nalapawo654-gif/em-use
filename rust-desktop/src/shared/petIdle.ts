// Per-pet daily flourishes. The scheduler is shared; each pet owns its own named set,
// designed for its character. Frames are whole-body transforms layered additively
// (WAAPI composite: 'add') on top of the pet's own breathing / rig animation.
export interface IdleFlourish { name: string; duration: number; frames: Keyframe[] }
export type IdleScene = 'aquarium' | 'buddy' | 'beaver' | 'cultivation' | 'battery' | 'hamster' | 'hermit' | 'piranha' | 'potato' | 'basketball'

const k = (transform: string, offset?: number, easing?: string): Keyframe => ({ transform, ...(offset === undefined ? {} : { offset }), ...(easing ? { easing } : {}) })
const REST = 'translate(0, 0) rotate(0deg) scale(1, 1)'
const f = (name: string, duration: number, ...mid: Keyframe[]): IdleFlourish => ({ name, duration, frames: [k(REST, 0), ...mid, k(REST, 1)] })
const out = 'cubic-bezier(.2,.8,.3,1)', inn = 'cubic-bezier(.6,0,.8,.4)'
/** A jump that squashes on take-off and landing; `h` is lift in % of the actor's height. */
function hops(name: string, duration: number, count: number, h: number): IdleFlourish {
  const frames: Keyframe[] = [], step = 1 / count
  for (let i = 0; i < count; i++) {
    const o = i * step
    frames.push(k('translate(0, 3%) rotate(0deg) scale(1.06, .93)', o + step * .18, out))
    frames.push(k(`translate(0, -${h}%) rotate(0deg) scale(.96, 1.05)`, o + step * .55, inn))
    frames.push(k('translate(0, 2%) rotate(0deg) scale(1.05, .95)', o + step * .88, out))
  }
  return f(name, duration, ...frames)
}
function shake(name: string, duration: number, count: number, x: number, deg: number): IdleFlourish {
  const frames: Keyframe[] = []
  for (let i = 1; i <= count; i++) frames.push(k(`translate(${i % 2 ? x : -x}%, 0) rotate(${i % 2 ? deg : -deg}deg) scale(1, 1)`, i / (count + 1)))
  return f(name, duration, ...frames)
}

export const IDLE_FLOURISHES: Record<IdleScene, IdleFlourish[]> = {
  // The bowl itself: water sloshing and a lazy bob, the fish keep swimming inside.
  aquarium: [
    f('slosh', 2400, k('translate(-1.2%, 0) rotate(-2.2deg) scale(1, 1)', .25), k('translate(1.2%, 0) rotate(2deg) scale(1, 1)', .6), k('translate(-.5%, 0) rotate(-.8deg) scale(1, 1)', .85)),
    f('bob', 2000, k('translate(0, -3%) rotate(0deg) scale(1.01, .99)', .45, out), k('translate(0, .8%) rotate(0deg) scale(1, 1)', .8)),
  ],
  // Inflatable worker: puffs up, dozes off, stretches, sneaks a look around.
  buddy: [
    f('puff', 1500, k('translate(0, -2%) rotate(0deg) scale(1.1, 1.06)', .35, out), k('translate(0, 1%) rotate(0deg) scale(.95, 1.02)', .6), k('translate(0, 0) rotate(0deg) scale(1.03, 1)', .8)),
    f('doze', 2600, k('translate(1%, 2%) rotate(6deg) scale(1, .98)', .3), k('translate(0, 0) rotate(1deg) scale(1, 1)', .45, out), k('translate(1.4%, 2.5%) rotate(8deg) scale(1, .98)', .78), k('translate(0, -1%) rotate(-1deg) scale(1, 1.01)', .9, out)),
    f('stretch', 1800, k('translate(0, -5%) rotate(0deg) scale(.95, 1.09)', .35, out), k('translate(0, -5%) rotate(-2deg) scale(.95, 1.09)', .65), k('translate(0, 1%) rotate(0deg) scale(1.04, .96)', .85)),
    f('peek', 2200, k('translate(-4%, 0) rotate(-5deg) scale(1, 1)', .25, out), k('translate(-4%, 0) rotate(-5deg) scale(1, 1)', .4), k('translate(4%, 0) rotate(5deg) scale(1, 1)', .65, out), k('translate(4%, 0) rotate(5deg) scale(1, 1)', .8)),
  ],
  // Beaver: gnaws, flicks a little hop, leans forward to sniff.
  beaver: [
    shake('gnaw', 1000, 9, .4, 2.2),
    hops('tail-hop', 1100, 2, 4),
    f('sniff', 1700, k('translate(3%, -2%) rotate(5deg) scale(1, 1)', .3, out), k('translate(3.5%, -2.5%) rotate(6deg) scale(1, 1)', .45), k('translate(3%, -2%) rotate(4deg) scale(1, 1)', .6), k('translate(3.5%, -2.5%) rotate(6deg) scale(1, 1)', .72)),
  ],
  // Cultivator: breathes the qi in and floats, sways in meditation, a pulse of power.
  cultivation: [
    f('levitate', 3400, k('translate(0, -7%) rotate(0deg) scale(1, 1)', .45, 'ease-in-out'), k('translate(0, -6%) rotate(0deg) scale(1, 1)', .65, 'ease-in-out')),
    f('sway', 3000, k('translate(-1%, 0) rotate(-3deg) scale(1, 1)', .3, 'ease-in-out'), k('translate(1%, 0) rotate(3deg) scale(1, 1)', .7, 'ease-in-out')),
    f('qi-pulse', 1800, k('translate(0, -1%) rotate(0deg) scale(1.05, 1.05)', .25, out), k('translate(0, 0) rotate(0deg) scale(1, 1)', .5), k('translate(0, -1%) rotate(0deg) scale(1.06, 1.06)', .72, out)),
  ],
  // Battery athlete: static buzz, a jump, flexing.
  battery: [
    shake('buzz', 800, 11, 1.2, 0),
    hops('jump', 1000, 1, 9),
    f('flex', 1500, k('translate(0, 1%) rotate(0deg) scale(1.07, .95)', .25, out), k('translate(0, -3%) rotate(0deg) scale(.97, 1.07)', .55, out), k('translate(0, -3%) rotate(0deg) scale(.97, 1.07)', .75)),
  ],
  // Hamster: washes its face, double hop, looks left and right.
  hamster: [
    shake('face-wash', 1000, 7, .3, 5),
    hops('double-hop', 1200, 2, 7),
    f('look-around', 2000, k('translate(-3%, 0) rotate(-6deg) scale(1, 1)', .25, out), k('translate(-3%, 0) rotate(-6deg) scale(1, 1)', .42), k('translate(3%, 0) rotate(6deg) scale(1, 1)', .65, out), k('translate(3%, 0) rotate(6deg) scale(1, 1)', .82)),
  ],
  // Hermit crab: tucks into the box and pops out, scuttles sideways, waves a claw.
  hermit: [
    f('tuck', 1700, k('translate(0, 8%) rotate(0deg) scale(1.06, .82)', .25, out), k('translate(0, 8%) rotate(0deg) scale(1.06, .82)', .55), k('translate(0, -4%) rotate(0deg) scale(.96, 1.06)', .75, out)),
    f('scuttle', 2200, k('translate(-3%, 0) rotate(-2deg) scale(1, 1)', .12), k('translate(-6%, 0) rotate(2deg) scale(1, 1)', .24), k('translate(-8%, 0) rotate(-2deg) scale(1, 1)', .36), k('translate(-6%, 0) rotate(2deg) scale(1, 1)', .6), k('translate(-3%, 0) rotate(-2deg) scale(1, 1)', .75), k('translate(-1%, 0) rotate(1deg) scale(1, 1)', .88)),
    f('claw-wave', 1400, k('translate(1%, -1%) rotate(-7deg) scale(1, 1)', .25, out), k('translate(-1%, 0) rotate(5deg) scale(1, 1)', .5), k('translate(1%, -1%) rotate(-6deg) scale(1, 1)', .72)),
  ],
  // Man-eating flower: sways on its stem, snaps at a fly, yawns.
  piranha: [
    f('stem-sway', 3200, k('translate(-2%, 0) rotate(-5deg) scale(1, 1)', .3, 'ease-in-out'), k('translate(2%, 0) rotate(5deg) scale(1, 1)', .7, 'ease-in-out')),
    f('snap', 800, k('translate(0, 2%) rotate(0deg) scale(1.08, .9)', .3, inn), k('translate(0, -3%) rotate(0deg) scale(.95, 1.08)', .55, out), k('translate(0, 1%) rotate(0deg) scale(1.03, .97)', .78)),
    f('yawn', 1900, k('translate(0, -3%) rotate(-2deg) scale(1, 1.07)', .4, out), k('translate(0, -3%) rotate(2deg) scale(1, 1.07)', .65), k('translate(0, 1%) rotate(0deg) scale(1.02, .98)', .85)),
  ],
  // Potato warrior: marches in place, salutes, heavy stomp.
  potato: [
    f('march', 1500, k('translate(0, -3%) rotate(-3deg) scale(1, 1)', .125), k('translate(0, 0) rotate(0deg) scale(1.02, .98)', .25), k('translate(0, -3%) rotate(3deg) scale(1, 1)', .375), k('translate(0, 0) rotate(0deg) scale(1.02, .98)', .5), k('translate(0, -3%) rotate(-3deg) scale(1, 1)', .625), k('translate(0, 0) rotate(0deg) scale(1.02, .98)', .75), k('translate(0, -3%) rotate(3deg) scale(1, 1)', .875)),
    f('salute', 1700, k('translate(0, -2%) rotate(-5deg) scale(1, 1.03)', .25, out), k('translate(0, -2%) rotate(-5deg) scale(1, 1.03)', .7)),
    f('stomp', 1300, k('translate(0, -8%) rotate(0deg) scale(.96, 1.05)', .35, out), k('translate(0, 4%) rotate(0deg) scale(1.1, .88)', .5, inn), k('translate(0, 0) rotate(0deg) scale(.98, 1.02)', .7, out)),
  ],
  // Sharpshooter: jump-shot fake, crossover pivot.
  basketball: [
    hops('jump-shot', 1100, 1, 10),
    f('crossover', 1500, k('translate(-5%, 1%) rotate(-5deg) scale(1, 1)', .3, out), k('translate(5%, 1%) rotate(5deg) scale(1, 1)', .6, out), k('translate(0, 0) rotate(0deg) scale(1, 1)', .85)),
  ],
}

/** Random wait before the next flourish; the first one comes sooner so the pet feels alive right away. */
export function nextIdleDelay(first: boolean, random = Math.random) { return first ? 3500 + random() * 3500 : 7000 + random() * 9000 }
/** Picks a flourish, avoiding an immediate repeat when the pet has more than one. */
export function pickFlourish(list: IdleFlourish[], previous: string | undefined, random = Math.random) {
  const pool = list.length > 1 ? list.filter(item => item.name !== previous) : list
  return pool[Math.floor(random() * pool.length)]!
}
/** Host states during which the pet is busy and must not be moved by a flourish. */
export const IDLE_BUSY = '.has-panel, .has-action, .has-details, .is-moving, .calendar-is-open, .has-notice, .is-capturing, .hoop-aiming'
export const IDLE_BUSY_INSIDE = '[data-action]:not([data-action="idle"]), [data-play]:not([data-play="idle"]), .is-wiping'
