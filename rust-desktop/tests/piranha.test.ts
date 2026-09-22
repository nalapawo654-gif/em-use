import test from 'node:test'
import assert from 'node:assert/strict'
import { PIRANHA_ACTIONS, piranhaLevel, piranhaIdle, beginPiranha, advancePiranha, piranhaFrame } from '../src/piranha/play'
import { DEFAULT_SETTINGS, PIRANHA_SKINS, SCENE_LABELS } from '../src/shared/types'
import { validateSettings } from '../src/shared/settings'
import { CALENDAR_PROPS } from '../src/shared/calendarProps'
import { MESSAGE_PERSONAS } from '../src/shared/messageNotice'
import { UPDATE_PERSONAS } from '../src/shared/updateNotice'
test('quota boundaries distinguish unknown from exhausted and retain low states', () => {
  assert.deepEqual([100,76,75,51,50,26,25,1,0,-1,null,NaN,Infinity].map(piranhaLevel), ['full','full','hungry','hungry','low','low','empty','empty','empty','empty','unknown','unknown','unknown'])
})
test('short interactions complete and restore latest quota; sleeping explicitly persists', () => {
  for (const action of PIRANHA_ACTIONS) {
    const play = beginPiranha(action.id, 100)
    if (action.duration !== null) {
      assert.equal(advancePiranha(play, 100 + action.duration - 1).action, action.id)
      const end = advancePiranha(play, 100 + action.duration)
      assert.deepEqual(end, piranhaIdle())
      assert.equal(piranhaFrame(0, 'classic', end.action).frame, 3)
      assert.equal(piranhaFrame(null, 'classic', end.action).frame, 0)
    } else assert.deepEqual(advancePiranha(play, 999999), play)
  }
})
test('all skins keep costume atlas through every quota and interaction pose', () => {
  for (const skin of PIRANHA_SKINS) {
    const next = {...DEFAULT_SETTINGS, ...validateSettings({scene:'piranha', piranhaSkin:skin.id})}
    assert.equal(next.scene, 'piranha'); assert.equal(next.piranhaSkin, skin.id)
    assert.equal(next.buddySkin, DEFAULT_SETTINGS.buddySkin)
    for (const percent of [100,50,10,0,null]) {
      for (const action of ['idle', ...PIRANHA_ACTIONS.map(a=>a.id)] as const) {
        const frame = piranhaFrame(percent, skin.id, action, 1000)
        assert.equal(frame.atlas, skin.id === 'classic' ? 'character' : 'costume')
        assert.ok(frame.frame >= 0 && frame.frame < 16)
      }
    }
  }
  assert.deepEqual(validateSettings({piranhaSkin:'missing',scene:'unknown'}),{})
  assert.equal({...DEFAULT_SETTINGS,...validateSettings({scene:'buddy'})}.piranhaSkin,'classic')
})
test('new scene has calendar, message and update personas on shared services', () => {
  assert.match(SCENE_LABELS.piranha,/食人花/)
  assert.equal(CALENDAR_PROPS.piranha.name,'叶片翻页历')
  assert.equal(MESSAGE_PERSONAS.piranha.object,'藤蔓来信')
  assert.equal(UPDATE_PERSONAS.piranha.object,'花种补给袋')
})
