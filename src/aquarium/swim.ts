export interface Point { x: number; y: number }
export interface Swimmer extends Point {
  width: number; phase: number; goal: Point; vx: number; vy: number;
  facing: number; heading: number; nextGoal: number; nextBubble: number;
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export function createSwimmer(x: number, y: number, width: number, phase: number): Swimmer {
  return { x, y, width, phase, goal: { x, y }, vx: 0, vy: 0, facing: x < .5 ? 1 : -1, heading: x < .5 ? 1 : -1, nextGoal: 0, nextBubble: .8 + phase * .35 }
}
export function swimBounds(top: number, width: number) {
  // At almost-empty quota the fish keep a small refuge above the gravel.
  const bottom = .83 - width * .35
  return { left: .12 + width / 2, right: .88 - width / 2, top: Math.min(bottom - .025, Math.max(.35, top + width * .48)), bottom }
}
export function swimStep(fish: Swimmer, dt: number, time: number, top: number, aim?: Point, random = Math.random) {
  const bounds = swimBounds(top, fish.width)
  if (!aim && (time >= fish.nextGoal || Math.hypot(fish.goal.x - fish.x, fish.goal.y - fish.y) < .025)) {
    // Alternate upper/lower destinations; independent timing avoids a shared loop.
    const upper = fish.y > (bounds.top + bounds.bottom) / 2
    fish.goal = {
      x: bounds.left + random() * (bounds.right - bounds.left),
      y: bounds.top + (upper ? random() * .35 : .65 + random() * .35) * (bounds.bottom - bounds.top),
    }
    fish.nextGoal = time + 3.5 + random() * 3
  }
  const destination = aim ?? fish.goal
  let x = clamp(destination.x, bounds.left, bounds.right), y = clamp(destination.y, bounds.top, bounds.bottom)
  // Swim beside the quota, and go underneath it when crossing the tank.
  // A waypoint keeps fish from getting trapped against an invisible text box.
  const leftLane = .34 - fish.width * .5, rightLane = .66 + fish.width * .5
  const passage = .64 + fish.width * .4
  if (y < passage) x = x < .5 ? Math.min(x, leftLane) : Math.max(x, rightLane)
  if (fish.y < passage && ((fish.x < .5 && x > leftLane) || (fish.x >= .5 && x < rightLane))) {
    x = fish.x < .5 ? leftLane : rightLane; y = Math.min(bounds.bottom, passage + .02)
  } else if (y < passage && fish.x > leftLane + .008 && fish.x < rightLane - .008) {
    y = Math.min(bounds.bottom, passage + .02)
  }
  const dx = x - fish.x, dy = y - fish.y
  const distance = Math.hypot(dx, dy), speed = .065 + .012 * Math.sin(time * 1.3 + fish.phase)
  const ease = 1 - Math.exp(-dt * 3)
  const travel = Math.min(speed, distance * 1.4)
  fish.vx += ((distance ? dx / distance * travel : 0) - fish.vx) * ease
  fish.vy += ((distance ? dy / distance * travel : 0) - fish.vy) * ease
  fish.x = clamp(fish.x + fish.vx * dt, bounds.left, bounds.right)
  fish.y = clamp(fish.y + fish.vy * dt, bounds.top, bounds.bottom)
  if (Math.abs(fish.vx) > .006) fish.heading = Math.sign(fish.vx)
  fish.facing += (fish.heading - fish.facing) * (1 - Math.exp(-dt * 5))
}
