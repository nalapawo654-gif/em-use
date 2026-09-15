<script setup lang="ts">
import { ref } from 'vue'
import { api, appState as state } from '../bridge'
import type { Settings } from '../shared/types'
import CalendarCard from './CalendarCard.vue'
const error=ref('')
async function set(patch:Partial<Settings>){error.value='';try{if(patch.calendarSystemNotifications)await api.calendarNotificationPermission?.();await api.settings(patch)}catch(e){error.value=String(e instanceof Error?e.message:e)}}
</script>
<template><section class="calendar-settings"><h2>咚咚日程 · 伙伴帮你记着</h2><p>日程跟随本机咚咚，独立于额度账户。11 位伙伴都有自己的日历小道具，可查看今日安排；互动时会让开。</p><label v-for="item in [{key:'calendarEnabled',title:'日程提醒',help:'同步今天的安排，在开始前轻轻提醒。'},{key:'calendarPreview',title:'显示标题与地点',help:'关闭后只显示时间和“一项日程”。'},{key:'calendarAtStart',title:'开始时再提醒',help:'已点“知道了”的日程不再重复提醒。'},{key:'calendarSystemNotifications',title:'收起或穿透时使用系统通知',help:'受系统通知权限和免打扰控制。默认关闭。'}]" :key="item.key" class="setting-row"><span><b>{{item.title}}</b><small>{{item.help}}</small></span><input type="checkbox" role="switch" :checked="state.settings[item.key as keyof Settings]===true" @change="set({[item.key]:($event.target as HTMLInputElement).checked})"/></label><label class="setting-row"><span><b>提前多久提醒</b><small>默认 5 分钟；全天事项仅显示在列表中。</small></span><select aria-label="提前多久提醒" :value="state.settings.calendarLeadMinutes" @change="set({calendarLeadMinutes:Number(($event.target as HTMLSelectElement).value)})"><option v-for="n in [1,5,10,15]" :key="n" :value="n">{{n}} 分钟</option></select></label><p v-if="error" role="alert">{{error}}</p><CalendarCard/></section></template>
