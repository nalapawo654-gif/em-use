import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarDay, calendarTime, nextCalendarEvent, reminderHeading, overlaps, eventStatus } from '../src/shared/calendar'
import { validateSettings } from '../src/shared/settings'
import type { CalendarEvent, CalendarState } from '../src/shared/types'
const start = Date.parse('2026-09-15T15:00:00+08:00')
const event: CalendarEvent = {key:'a',title:'需求评审',start,end:start+90*60000,rooms:['成都 602'],allDay:false}
test('calendar uses Beijing day and reports real remaining time rather than hardcoded five minutes',()=>{
 assert.equal(calendarDay(Date.parse('2026-09-14T16:00:00Z')),'2026-09-15')
 assert.equal(calendarTime(start),'15:00')
 assert.equal(reminderHeading(event,start-5*60000),'还有 5 分钟')
 assert.equal(reminderHeading(event,start-30000),'不到 1 分钟')
 assert.equal(reminderHeading(event,start),'到开始时间了')
 assert.equal(eventStatus(event,start),'按计划进行中')
})
test('current schedules, all-day and overlap semantics',()=>{
 const state:CalendarState={epoch:'A',status:'ready',message:'',account:null,date:'2026-09-15',fetchedAt:start,active:[],items:[{...event,key:'all',allDay:true},event]}
 assert.equal(nextCalendarEvent(state,start)?.key,'a')
 assert.equal(nextCalendarEvent({...state,date:'2026-09-14'},start),undefined)
 assert.equal(nextCalendarEvent(state,event.end),undefined)
 assert.equal(overlaps(event,[event,{...event,key:'b',start:event.end}]),false)
 assert.equal(overlaps(event,[event,{...event,key:'b',start:start+60000}]),true)
})
test('calendar preferences validate without allowing malformed reminder intervals',()=>{
 assert.deepEqual(validateSettings({calendarEnabled:false,calendarPreview:false,calendarLeadMinutes:5}),{calendarEnabled:false,calendarPreview:false,calendarLeadMinutes:5})
 for(const n of [NaN,Infinity,-5,0,2,5.2,999])assert.deepEqual(validateSettings({calendarLeadMinutes:n}),{})
})
