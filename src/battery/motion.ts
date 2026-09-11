import { batteryLevel, LIFT_INTERVAL, type BatteryPlay } from './play'
export type Point = [number, number]
export type BatteryExercise = 'jump' | 'run' | 'knees' | 'lift' | 'stretch' | 'breathe' | 'lie' | 'wait' | 'rope' | 'charge' | 'towel' | 'cheer' | 'taichi' | 'aerobics' | 'yoga'
export interface BatteryPose {
  x: number; y: number; angle: number; leftHand: Point; rightHand: Point; leftFoot: Point; rightFoot: Point;
  exercise: BatteryExercise; effort: number; air: number;
}
export const BATTERY_FLOOR = 432
export const BATTERY_SHOE_HEIGHT = 24
export function rotateBatteryPoint(point: Point, angle: number): Point {
  return [point[0] * Math.cos(angle) - point[1] * Math.sin(angle), point[0] * Math.sin(angle) + point[1] * Math.cos(angle)]
}
/** Every grounded pose shares the same sole baseline; only explicit hops leave it. */
export function batteryGrounding(p: BatteryPose) {
  const left = rotateBatteryPoint(p.leftFoot, p.angle), right = rotateBatteryPoint(p.rightFoot, p.angle)
  const x = 246 + p.x, y = p.exercise === 'lie' ? BATTERY_FLOOR - 76 : BATTERY_FLOOR - BATTERY_SHOE_HEIGHT - Math.max(left[1], right[1]) - p.air
  return { x, y, leftSole: [x + left[0] - 9, y + left[1] + BATTERY_SHOE_HEIGHT] as Point, rightSole: [x + right[0] + 9, y + right[1] + BATTERY_SHOE_HEIGHT] as Point }
}
export function batteryPose(percent: number | null, play: BatteryPlay, time: number, gentle = false): BatteryPose {
  const level = batteryLevel(percent), t = gentle ? 0 : (play.action === 'idle' ? time : Math.max(0, time - play.since)) / 1000
  const highCycle = ['jump', 'run', 'knees', 'taichi', 'aerobics', 'yoga'] as const
  const mediumCycle = ['run', 'taichi', 'aerobics', 'yoga'] as const
  const exercise: BatteryExercise = play.action === 'charge' ? 'charge' : play.action === 'rest' || level === 'empty' ? 'lie'
    : play.action !== 'idle' ? play.action : level === 'full' ? highCycle[Math.floor(t / 7) % highCycle.length]
    : level === 'bright' ? mediumCycle[Math.floor(t / 8) % mediumCycle.length] : level === 'steady' ? 'lift' : level === 'tired' ? 'stretch' : level === 'low' ? 'breathe' : 'wait'
  const effort = ({full: 1, bright: .74, steady: .44, tired: .18, low: .05, empty: 0, unknown: 0})[level]
  const pace = t * (level === 'full' ? 8 : level === 'bright' ? 6 : 3), wave = gentle ? .55 : Math.sin(pace)
  const p: BatteryPose = { x: 0, y: 0, angle: 0, leftHand: [-96, 20], rightHand: [96, 20], leftFoot: [-49, 154], rightFoot: [49, 154], exercise, effort, air: 0 }
  if (exercise === 'lie') return { ...p, x: -8, angle: -Math.PI / 2 + .08, leftHand: [-54, 55], rightHand: [54, 65], leftFoot: [-38, 133], rightFoot: [39, 142] }
  const seated = level === 'tired' || level === 'low' || level === 'empty'
  if (seated) { p.angle = .10; p.leftFoot = [-83, 110]; p.rightFoot = [75, 105]; p.leftHand = [-80, 86]; p.rightHand = [83, 88] }
  if (exercise === 'jump' || exercise === 'rope') {
    const hop = gentle ? .65 : Math.max(0, Math.sin(t * 8)), spread = exercise === 'jump' ? hop * 35 : 0
    p.air = gentle ? 0 : hop * 36 * effort; p.angle = wave * .025 * effort
    p.leftFoot = [-49 - spread, seated ? 110 : 154]; p.rightFoot = [49 + spread, seated ? 110 : 154]
    p.leftHand = [-95 - spread * .4, 12 - (exercise === 'jump' ? hop * 140 : 0) * effort]; p.rightHand = [95 + spread * .4, p.leftHand[1]]
  } else if (exercise === 'run' || exercise === 'knees') {
    p.angle = wave * .035
    p.leftFoot = [-50 + wave * 13, 150 - Math.max(0, wave) * (exercise === 'knees' ? 82 : 50) * effort]
    p.rightFoot = [50 - wave * 13, 150 - Math.max(0, -wave) * 50 * effort]
    p.leftHand = [-86, -16 + wave * 36 * effort]; p.rightHand = [86, -16 - wave * 36 * effort]
  } else if (exercise === 'lift') {
    const phase = play.action === 'lift' ? (gentle ? (Number.isFinite(play.lastRep) ? .5 : 0) : Math.max(0, Math.min(1, (time - play.lastRep) / LIFT_INTERVAL))) : (Math.sin(t * 2.4) + 1) / 2
    const lift = play.action === 'lift' ? (Number.isFinite(play.lastRep) ? Math.sin(phase * Math.PI) : 0) : phase
    p.leftHand = [-95, 12 - lift * (58 + effort * 70)]; p.rightHand = [95, p.leftHand[1]]
  } else if (exercise === 'taichi') {
    // Slow opposing cloud hands, weight shifts and a wide grounded stance.
    const q = gentle ? .65 : Math.sin(t * 1.05), orbit = gentle ? .5 : Math.cos(t * 1.05)
    p.x = q * 12 * effort; p.angle = q * .06 * effort
    p.leftHand = [-90 + q * 20 * effort, -32 - orbit * 30 * effort]
    p.rightHand = [90 + q * 20 * effort, -12 + orbit * 40 * effort]
    p.leftFoot = [-73, seated ? 105 : 140]; p.rightFoot = [73, seated ? 105 : 140]
  } else if (exercise === 'aerobics') {
    // Alternating step-touch and overhead reaches; one shoe always supports the body.
    const q = gentle ? .75 : Math.sin(t * 5.2)
    p.x = q * 18 * effort; p.angle = q * .075 * effort
    p.leftHand = [-92, -20 - Math.max(0, q) * 119 * effort]
    p.rightHand = [92, -20 - Math.max(0, -q) * 119 * effort]
    p.leftFoot = [-56 - Math.max(0, q) * 24 * effort, (seated ? 110 : 150) - Math.max(0, q) * 29 * effort]
    p.rightFoot = [56 + Math.max(0, -q) * 24 * effort, (seated ? 110 : 150) - Math.max(0, -q) * 29 * effort]
  } else if (exercise === 'yoga') {
    // Tree balance flows into a side stretch without changing the contact plane.
    const side = gentle ? 0 : (1 - Math.cos(t * Math.PI / 6)) / 2
    p.angle = -.20 * side * effort
    p.leftHand = [-26 - side * 36, -169 - side * 13 * effort]
    p.rightHand = [26 - side * 25, -169 - side * 13 * effort]
    p.leftFoot = [-43, seated ? 105 : 154]
    p.rightFoot = [41 + side * 20 * effort, (seated ? 105 : 154) - 63 * effort * (1 - side)]
  } else if (exercise === 'stretch') { p.leftHand = [-95, -15 + wave * 6]; p.rightHand = [87, 65]; p.angle += wave * .025 }
  else if (exercise === 'breathe' || exercise === 'wait') { p.leftHand[1] += Math.sin(t * 1.6) * 1.6; p.rightHand[1] += Math.sin(t * 1.6) * 1.6 }
  else if (exercise === 'charge') { p.angle = 0; p.leftHand = [-85, 39]; p.rightHand = [85, 39]; }
  else if (exercise === 'towel') p.rightHand = [35 + Math.sin(t * 6) * 15, -102]
  else if (exercise === 'cheer') { p.rightHand = [106, -116 + Math.sin(t * 9) * 8]; p.angle -= .06 }
  return p
}
