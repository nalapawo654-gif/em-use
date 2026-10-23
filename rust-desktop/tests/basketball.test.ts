import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COURT, DISTANCES, station, newRound, origin, launch, stepBall, finishShot, shotKind, aimFromPull, previewArc, type Ball } from '../src/basketball/game'
import { validateSettings } from '../src/shared/settings'
import { DEFAULT_SETTINGS } from '../src/shared/types'
function simulate(ball: Ball, dt = 1 / 60) { let b = ball; for (let i = 0; i < 2000 && !b.done; i++) b = stepBall(b, dt); assert.ok(b.done); return b }
function centered(level: number) {
  const start = origin(level), t = 1.3, vx = ((COURT.left + COURT.right) / 2 - start.x) / t, vy = (COURT.rimY - start.y - .5 * COURT.gravity * t * t) / t
  return { angle: Math.atan2(-vy, vx) * 180 / Math.PI, power: Math.hypot(vx, vy) }
}
test('quota boundaries, unknown and recovery select distinct legal positions', () => {
  for (const [value, result] of [[100,0],[75.001,0],[75,1],[74.999,1],[50.001,1],[50,2],[49.999,2],[25.001,2],[25,3],[24.999,3],[0,3]] as const) assert.equal(station(value), result)
  for (const value of [null, NaN, Infinity]) assert.equal(station(value), null)
  assert.ok(DISTANCES.every((s, i) => !i || s.x < DISTANCES[i-1]!.x))
  const practice = newRound(null); assert.equal(practice.practice, true); assert.equal(practice.level, 1)
  assert.equal(newRound(0).practice, false); assert.equal(newRound(100).level, 0)
})
test('each quota distance has a reachable, deterministic clean shot', () => {
  for (let level = 0; level < 4; level++) {
    const { angle, power } = centered(level)
    assert.ok(angle >= 20 && angle <= 85 && power <= 570)
    const b = simulate(launch(level, angle, power))
    assert.equal(shotKind(b), 'swish', `distance ${level}`)
    assert.deepEqual(b, simulate(launch(level, angle, power)))
    assert.equal(shotKind(simulate(launch(level, angle, power), 1 / 30)), 'swish')
    assert.equal(shotKind(simulate(launch(level, angle, power), 1 / 120)), 'swish')
  }
})
test('basket requires downward crossing inside opening; ground rebounds do not score', () => {
  const b = launch(1, 60, 300)
  assert.equal(stepBall({ ...b, x: 340, y: 180, vx: 0, vy: -100 }, .1).scored, false)
  assert.equal(stepBall({ ...b, x: 310, y: 170, vx: 0, vy: 150 }, .1).scored, false)
  assert.equal(stepBall({ ...b, x: 340, y: 170, vx: 0, vy: 150, groundAt: 0 }, .1).scored, false)
  const scored = stepBall({ ...b, x: 340, y: 170, vx: 0, vy: 150 }, .1)
  assert.equal(scored.scored, true); const scoredAt = scored.scoredAt
  assert.equal(stepBall(scored, .1).scoredAt, scoredAt)
})
test('rim and board reflect the ball and disqualify swish', () => {
  const b = launch(1, 60, 300)
  const rim = stepBall({ ...b, x: COURT.left, y: COURT.rimY - 14, vx: 0, vy: 180 }, .04)
  assert.equal(rim.rim, true); assert.ok(rim.vy < 0)
  const board = stepBall({ ...b, x: COURT.boardX - 12, y: 145, vx: 200, vy: 0 }, .04)
  assert.equal(board.board, true); assert.ok(board.vx < 0)
  assert.equal(shotKind({ ...rim, scored: true }), 'rim'); assert.equal(shotKind({ ...board, scored: true }), 'bank')
})
test('ten shots settle; streak resets on misses and score is capped by round', () => {
  let round = newRound(25); const {angle,power} = centered(3), hit = simulate(launch(3,angle,power)), miss = simulate(launch(3,20,120))
  assert.equal(shotKind(miss), 'miss'); assert.equal(finishShot(round, launch(3,angle,power)), round)
  for (let i=0;i<10;i++) round=finishShot(round, i===3 ? miss : hit)
  assert.equal(round.shots,10); assert.equal(round.score,54); assert.equal(round.hits,9); assert.equal(round.swishes,9); assert.equal(round.best,6); assert.equal(round.streak,6)
  assert.equal(finishShot(round,hit),round); assert.equal(round.level,3); assert.equal(newRound(100).level,0)
})
test('pointer aim stays bounded, path shows only a short opening segment', () => {
  const aim=aimFromPull(-30,40); assert.ok(Math.abs(aim.angle-53.13010235415598)<1e-10); assert.equal(aim.power,350)
  assert.ok(aimFromPull(-10000,10000).power<=570); assert.ok(aimFromPull(20,-20).angle>=20)
  const path=previewArc(3,60,350); assert.deepEqual(path[0],origin(3)); assert.ok(path.at(-1)!.x<COURT.left)
})
test('scene and jersey use shared validation without overwriting other pets', () => {
  assert.deepEqual(validateSettings({scene:'basketball',basketballSkin:'mint'}),{scene:'basketball',basketballSkin:'mint'})
  assert.deepEqual(validateSettings({basketballSkin:'invalid'}),{})
  const saved={...DEFAULT_SETTINGS,...validateSettings({scene:'basketball',basketballSkin:'away'})}
  assert.equal(saved.potatoSkin,DEFAULT_SETTINGS.potatoSkin);assert.equal(saved.basketballSkin,'away')
})
