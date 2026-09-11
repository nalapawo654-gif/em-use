import { BATTERY_SKINS, type BatteryRealm, type BatterySkin } from '../shared/types'
import { BATTERY_LEVELS, batteryLevel, type BatteryPlay } from './play'
import { batteryPose, batteryGrounding, BATTERY_FLOOR, type Point } from './motion'
import type { BatteryAtlas } from './sprites'

function sprite(ctx: CanvasRenderingContext2D, atlas: BatteryAtlas, index: number, x: number, y: number, w: number, h: number, angle = 0) {
  const image = atlas[index], scale = Math.min(w / image.width, h / image.height)
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale); ctx.restore()
}
function floorSprite(ctx: CanvasRenderingContext2D, atlas: BatteryAtlas, index: number, x: number, width: number, height: number) {
  const image = atlas[index], scale = Math.min(width / image.width, height / image.height)
  ellipse(ctx, x, BATTERY_FLOOR + 1, image.width * scale * .43, 3, '#34402a18')
  sprite(ctx, atlas, index, x, BATTERY_FLOOR - image.height * scale / 2, width, height)
}
function curve(ctx: CanvasRenderingContext2D, start: Point, bend: Point, end: Point, width: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = width; ctx.strokeStyle = '#1d2321'
  ctx.beginPath(); ctx.moveTo(...start); ctx.quadraticCurveTo(...bend, ...end); ctx.stroke()
  ctx.lineWidth = width * .25; ctx.strokeStyle = '#515852'; ctx.stroke()
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
}
export function renderBattery(ctx: CanvasRenderingContext2D, atlas: BatteryAtlas, opts: { percent: number | null; play: BatteryPlay; time: number; skin: BatterySkin; realm: BatteryRealm; gentle: boolean; night: boolean; scenery: boolean }) {
  const { percent, play, time, gentle, night, scenery, realm } = opts
  const level = batteryLevel(percent), p = batteryPose(percent, play, time, gentle), skin = BATTERY_SKINS.findIndex(s => s.id === opts.skin), t = gentle ? 0 : time / 1000
  const ground = batteryGrounding(p), charging = p.exercise === 'charge', yoga = p.exercise === 'yoga'
  ctx.clearRect(0, 0, 512, 512)
  if (scenery) {
    // Side props sit outside the character's foot envelope. No half-rolled mat under its shoes.
    if (yoga) sprite(ctx, atlas, 21, 246, BATTERY_FLOOR + 3, 277, 106)
    else if (p.exercise !== 'lie') floorSprite(ctx, atlas, 20, 430, 79, 40)
    if (charging) floorSprite(ctx, atlas, 18, 57, 89, 78)
    else if (p.exercise !== 'lie') {
      if (realm === 'balcony') floorSprite(ctx, atlas, 12, 53, 88, 108)
      else if (realm === 'weekend') floorSprite(ctx, atlas, 10, 52, 87, 46)
      else floorSprite(ctx, atlas, 19, 54, 86, 70)
    }
    if (p.exercise === 'lie') sprite(ctx, atlas, 10, 119, BATTERY_FLOOR - 19, 92, 42)
    if ((realm === 'office' || realm === 'overtime') && !charging && p.exercise !== 'lie' && !gentle) {
      ctx.fillStyle = night ? '#afc595' : '#829967'; ctx.font = '20px serif'
      ctx.fillText('♪', 73, 332 - Math.sin(t * 2) * 7)
    }
  }
  const shadowAlpha = night ? '#0004' : '#333c3522'
  if (p.exercise === 'lie') ellipse(ctx, ground.x, BATTERY_FLOOR + 2, 147, 8, shadowAlpha)
  else for (const sole of [ground.leftSole, ground.rightSole]) {
    const gap = Math.max(0, BATTERY_FLOOR - sole[1])
    ellipse(ctx, sole[0], BATTERY_FLOOR + 1, Math.max(16, 33 - gap * .15), Math.max(2, 4 - gap * .025), shadowAlpha)
  }
  // A real cable connects the dock to the top terminal, with moving light travelling along it.
  if (charging) {
    const start: Point = [76, BATTERY_FLOOR - 70], finish: Point = [ground.x, ground.y - 139]
    const c1: Point = [139, BATTERY_FLOOR - 30], c2: Point = [100, ground.y - 191]
    ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.strokeStyle = '#344437'
    ctx.beginPath(); ctx.moveTo(...start); ctx.bezierCurveTo(...c1, ...c2, ...finish); ctx.stroke()
    const point = (u: number): Point => { const v = 1 - u; return [v*v*v*start[0]+3*v*v*u*c1[0]+3*v*u*u*c2[0]+u*u*u*finish[0],v*v*v*start[1]+3*v*v*u*c1[1]+3*v*u*u*c2[1]+u*u*u*finish[1]] }
    for (let i=0;i<4;i++) { const q=point(gentle ? .2+i*.19 : (t*.55+i*.24)%1); ellipse(ctx,...q,3,3,'#cef488') }
    ctx.fillStyle = '#bedb92';ctx.beginPath();ctx.roundRect(finish[0]-10,finish[1]-8,20,15,4);ctx.fill()
  }
  ctx.save(); ctx.translate(ground.x, ground.y); ctx.rotate(p.angle)
  // Exactly two legs and two shoes, rendered behind the torso.
  for (const [side, foot] of [[-1, p.leftFoot], [1, p.rightFoot]] as const) {
    curve(ctx, [side * 35, 88], [side * 27, 125], [foot[0], foot[1] - 12], 13)
    sprite(ctx, atlas, side === -1 ? 6 : 7, foot[0] + side * 9 * Math.cos(p.angle), foot[1] - side * 9 * Math.sin(p.angle), 73, 48, -p.angle)
  }
  for (const [side, hand] of [[-1, p.leftHand], [1, p.rightHand]] as const) {
    curve(ctx, [side * 57, -53], [side * 90, hand[1] > 0 ? 12 : -12], hand, 12)
  }
  sprite(ctx, atlas, BATTERY_SKINS[Math.max(0, skin)].body, 0, -25, 142, 244)
  // Faces and exact live percentage stay separate from the immutable shell art.
  const sleeping = p.exercise === 'lie', serene = ['yoga', 'taichi', 'charge'].includes(p.exercise), happy = ['full', 'bright'].includes(level) || play.action === 'cheer'
  ctx.strokeStyle = '#22271f'; ctx.lineWidth = 5.5; ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    const x = side * 28
    if (sleeping || serene || level === 'low' || level === 'tired') { ctx.beginPath(); ctx.moveTo(x - 10, -44); ctx.quadraticCurveTo(x, -36, x + 10, -44); ctx.stroke() }
    else if (happy) { ctx.beginPath(); ctx.moveTo(x - 10, -42); ctx.quadraticCurveTo(x, -61, x + 10, -42); ctx.stroke() }
    else { ellipse(ctx, x, -47, 4.5, 7, '#242a24'); ellipse(ctx, x + 1, -50, 1.3, 2, '#fff') }
    ellipse(ctx, side * 44, -22, 10, 6, '#ed8b7b75')
  }
  ctx.beginPath()
  if (happy && !sleeping && !serene) {
    ctx.moveTo(-14, -24); ctx.quadraticCurveTo(0, -18, 14, -24); ctx.bezierCurveTo(15, 5, -15, 5, -14, -24); ctx.fillStyle = '#532724'; ctx.fill()
    ellipse(ctx, 0, -3, 8, 3.5, '#e57b72')
  } else if (sleeping || level === 'steady') ellipse(ctx, 0, -15, 5, 7, '#593a2e')
  else { ctx.moveTo(-9, -12); ctx.quadraticCurveTo(0, serene || level === 'unknown' ? -4 : -23, 9, -12); ctx.stroke() }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = opts.skin === 'classic' ? '#2b652f' : '#614333'; ctx.font = '600 9px sans-serif'
  // Original playful wordmarks, never the removed official logo assets.
  const wordmark = BATTERY_SKINS[Math.max(0, skin)].mark
  ctx.fillStyle = opts.skin === 'classic' ? '#376238' : opts.skin === 'catl' ? '#275c7f' : '#624235'
  ctx.font = (opts.skin === 'classic' ? '600 10px' : '700 17px') + ' "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(wordmark, 0, 20)
  if (opts.skin === 'byd') { ctx.fillStyle = '#b93d40'; ctx.beginPath(); ctx.roundRect(-41, 43, 82, 35, 5); ctx.fill() }
  ctx.fillStyle = '#fffdf0'; ctx.font = '800 29px sans-serif'; ctx.fillText(level === 'unknown' ? '—' : Math.round(Math.max(0, Math.min(100, percent!))) + '%', 0, 61)
  // Shared quota also has an independent color meter, so a brand color cannot imply charge.
  ctx.fillStyle = '#2228'; ctx.beginPath(); ctx.roundRect(-33, 84, 66, 5, 2); ctx.fill()
  if (level !== 'unknown' && percent! > 0) { ctx.fillStyle = BATTERY_LEVELS[level].color; ctx.beginPath(); ctx.roundRect(-33, 84, 66 * Math.min(100, percent!) / 100, 5, 2); ctx.fill() }
  for (const [side, hand] of [[-1, p.leftHand], [1, p.rightHand]] as const) {
    sprite(ctx, atlas, side === -1 ? 4 : 5, hand[0], hand[1], 32, 35, side * -.2)
    if (p.exercise === 'lift') sprite(ctx, atlas, 8, hand[0], hand[1] - 9, 64, 36)
  }
  if (p.exercise === 'rope') {
    ctx.strokeStyle = '#d69244'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(...p.leftHand); ctx.bezierCurveTo(-163, 37 + Math.cos(t * 8) * 153, 163, 37 + Math.cos(t * 8) * 153, ...p.rightHand); ctx.stroke()
  }
  if (charging) {
    ctx.strokeStyle = '#bde779'; ctx.lineWidth = 3; ctx.globalAlpha = gentle ? .65 : .45 + Math.sin(t * 5) * .2
    ctx.beginPath(); ctx.ellipse(0, -123, 83, 18, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1
    ctx.fillStyle = '#abd46c'; ctx.beginPath(); ctx.moveTo(95,-75);ctx.lineTo(83,-50);ctx.lineTo(94,-50);ctx.lineTo(85,-26);ctx.lineTo(108,-57);ctx.lineTo(97,-57);ctx.closePath();ctx.fill()
  }
  if (play.action === 'towel') sprite(ctx, atlas, 11, ...p.rightHand, 71, 39, -.2)
  if (['steady', 'tired', 'low'].includes(level) && play.action !== 'towel' && play.action !== 'rest' && !charging) {
    ctx.fillStyle = '#72bacdcc'
    for (let i = 0; i < 2; i++) { const y = -75 + i * 30 + (gentle ? 0 : t * 19 % 27); ctx.beginPath(); ctx.moveTo(76 + i * 10, y); ctx.quadraticCurveTo(64 + i * 10, y + 22, 79 + i * 10, y + 17); ctx.quadraticCurveTo(86 + i * 10, y + 12, 76 + i * 10, y); ctx.fill() }
  }
  ctx.restore()
  if (sleeping) { ctx.fillStyle = night ? '#c5c0e3' : '#8b83a8'; ctx.font = 'italic 23px Georgia'; ctx.fillText('z Z', 338, 290 - Math.sin(t * 1.8) * 4) }
  if (play.action === 'cheer') { ctx.fillStyle = '#e8817a'; ctx.font = '27px serif'; ctx.fillText('♥', 364, 169 - Math.sin(t * 3) * 8) }
  if (play.completedAt !== null) sprite(ctx, atlas, 15, 356, 245, 85, 102)
  return p.exercise
}
