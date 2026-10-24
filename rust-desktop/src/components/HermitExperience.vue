<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhGearSix, PhMinus, PhGameController, PhTShirt, PhX, PhMoon, PhHandWaving, PhFeather, PhArrowsClockwise, PhArrowUpLeft, PhSun } from '@phosphor-icons/vue'
import { api, quotaState as state, quotaDisplay, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import { evolution, evolutionMotion, systemReduced } from '../evolution/controller'
import type { Corner } from '../shared/windowGeometry'
import { HERMIT_ACTIONS, HERMIT_PROPS } from '../hermit/catalog'
import { advanceHermit, beginHermit, catchFeather, hermitIdle, inCatchZone, isMainHermitAction, type HermitAction } from '../hermit/play'
import HermitVisual from './HermitVisual.vue'
import HermitSprite from './HermitSprite.vue'
import HermitWardrobe from './HermitWardrobe.vue'
import PetArcToolbar from './PetArcToolbar.vue'
import PetEvolution from './PetEvolution.vue'
import PetNotices from './PetNotices.vue'
import PetCalendar from './PetCalendar.vue'
import CodexQuotaReadout from './CodexQuotaReadout.vue'
import QuotaDetails from './QuotaDetails.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), teaseArea = ref<HTMLElement>()
const panel = ref<'play' | 'wardrobe' | 'details' | null>(null), notice = ref(''), calendarOpen = ref(false), noticeOpen = ref(false)
const play = ref(hermitIdle()), now = ref(performance.now()), visible = ref(!document.hidden)
const feather = ref({ x: .2, y: .3 }), mainAction = computed(() => isMainHermitAction(play.value.action))
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const prop = computed(() => HERMIT_PROPS.find(item => item.id === state.settings.hermitProp))
const blocked = computed(() => !!panel.value || moving.value || calendarOpen.value || noticeOpen.value || !!notice.value)
const still = computed(() => state.settings.reducedMotion || systemReduced.value || evolutionMotion.value !== 'full')
const icons = { knock: PhHandWaving, visit: PhTShirt, tease: PhFeather, sleep: PhMoon }
const status = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新连接', 'signed-out': '等待连接', connecting: '正在连接', unavailable: '暂不可用', forbidden: '暂无权限', resetting: '正在同步' }[state.status]))
const speech = computed(() => props.percent === null ? '账单还没来，先守好小家。' : props.percent <= 0 ? '今天不搬了。' : props.percent <= 25 ? '慢一点，小家一直在。' : '换个小窝，继续摸鱼。')
const actionTitle = computed(() => play.value.action === 'accessory' ? '整理小套件' : HERMIT_ACTIONS.find(item => item.id === play.value.action)?.label)
const actionHint = computed(() => play.value.action === 'tease' ? play.value.catches === 3 ? '抓到了！举高高。' : `把羽毛拖到虚线圈后松开 · ${play.value.catches}/3` : play.value.action === 'sleep' ? '我在家里歇一会儿。' : '小钳子忙着呢。')
let captured: { id: number; host: HTMLElement } | null = null, timer: ReturnType<typeof setInterval> | undefined
let nextIdle = performance.now() + 25000, lastIdle = ''
function release() { const old = captured; captured = null; if (old?.host.hasPointerCapture(old.id)) old.host.releasePointerCapture(old.id) }
function focus() { void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function cancel() { release(); play.value = hermitIdle(); nextIdle = performance.now() + 25000; focus() }
function escape() { panel.value = null; notice.value = ''; cancel() }
function act(action: HermitAction | 'visit') {
  if (calendarOpen.value || noticeOpen.value) return
  if (action === 'visit') { togglePanel('wardrobe'); return }
  if (action === 'sleep' && play.value.action === 'sleep') { cancel(); return }
  release(); panel.value = null; notice.value = ''; now.value = performance.now(); play.value = beginHermit(action, now.value)
  feather.value = { x: .2, y: .3 }
  if (action === 'tease') void nextTick(() => teaseArea.value?.focus({ preventScroll: true })); else focus()
}
function togglePanel(value: NonNullable<typeof panel.value>) { cancel(); panel.value = panel.value === value ? null : value; notice.value = '' }
function closePanel() { panel.value = null; focus() }
function bodyClick() { if (play.value.action === 'sleep') cancel(); else if (!mainAction.value) act('knock') }
async function run(task: () => Promise<unknown>, message: string) { try { await task() } catch { notice.value = message } }
function openSettings() { escape(); emit('settings') }
function point(event: PointerEvent) {
  const box = teaseArea.value?.getBoundingClientRect(); if (!box) return
  feather.value = { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) }
}
function featherDown(event: PointerEvent) { if (event.button !== 0 || captured || play.value.catches >= 3) return; const host = event.currentTarget as HTMLElement; captured = { id: event.pointerId, host }; host.setPointerCapture(event.pointerId); point(event); event.preventDefault() }
function featherMove(event: PointerEvent) { if (captured?.id === event.pointerId) point(event) }
function featherUp(event: PointerEvent) { if (captured?.id !== event.pointerId) return; point(event); release(); attempt(inCatchZone(feather.value.x, feather.value.y)) }
function attempt(valid = true) { now.value = performance.now(); play.value = catchFeather(play.value, now.value, valid) }
function featherKey(event: KeyboardEvent) {
  const delta: Record<string, [number, number]> = { ArrowUp: [0, -.06], ArrowDown: [0, .06], ArrowLeft: [-.06, 0], ArrowRight: [.06, 0] }
  const d = delta[event.key]
  if (d) { event.preventDefault(); feather.value = { x: Math.max(0, Math.min(1, feather.value.x + d[0])), y: Math.max(0, Math.min(1, feather.value.y + d[1])) } }
  if (event.key === ' ' && !event.repeat) { event.preventDefault(); attempt(inCatchZone(feather.value.x, feather.value.y)) }
}
function pause() { release(); if (play.value.action !== 'sleep') play.value = hermitIdle(); nextIdle = performance.now() + 25000 }
function visibility() { visible.value = !document.hidden; if (!visible.value) pause() }
watch(() => state.settings.hermitSkin, pause)
watch(blocked, value => { if (value && !mainAction.value) pause() })
onMounted(() => {
  timer = setInterval(() => {
    if (!visible.value) return
    const time = performance.now()
    if (play.value.action !== 'idle' && play.value.action !== 'sleep') { now.value = time; play.value = advanceHermit(play.value, time) }
    if (play.value.action === 'idle' && !blocked.value && evolution.phase === 'idle' && !still.value && time >= nextIdle) {
      nextIdle = time + (props.percent !== null && props.percent <= 25 ? 45000 : 25000 + Math.random() * 20000)
      if (props.percent === null || props.percent <= 0) return
      const choices: HermitAction[] = props.percent <= 25 ? ['peek', 'doze'] : ['peek', 'tidy', 'stretch', 'doze']
      const pool = choices.filter(item => item !== lastIdle), selected = pool[Math.floor(Math.random() * pool.length)]!
      lastIdle = selected; now.value = time; play.value = beginHermit(selected, time)
    }
  }, 100)
  document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', pause)
})
onUnmounted(() => { release(); clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', pause) })
async function demoSource() { if (isDesktop) return; await api.settings({ quotaSource: state.settings.quotaSource === 'codex' ? 'eastmoney' : 'codex', codexEnabled: true }); previewQuota(props.percent ?? 68) }
</script>
<template><div class="hermit-experience" :class="{ 'hermit-native': isDesktop }"><div class="hermit-hero">
  <section ref="widget" tabindex="-1" class="hermit-widget pet-arc-host" :class="{ 'has-panel': panel, 'has-action': mainAction, 'has-notice': notice, 'is-moving': moving, 'hermit-still': still, 'calendar-is-open': calendarOpen, 'hermit-notice-open': noticeOpen }" aria-label="纸箱寄居蟹场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
    <PetEvolution :blocked="blocked || mainAction"/>
    <PetNotices :blocked="!!panel || moving || !!notice || mainAction" :message-blocked="!!panel || moving || !!notice" :message-deferred="mainAction" :external-blocked="calendarOpen" :external-deferred="!!state.calendar?.active.length" @open-change="noticeOpen = $event"><template #parcel><HermitSprite class="message-prop-motion" prop :frame="9"/></template></PetNotices>
    <PetCalendar appearance="hermit" :blocked="!!panel || moving || !!notice || noticeOpen || mainAction" @open-change="calendarOpen = $event"><template #art><HermitSprite prop :frame="11"/></template></PetCalendar>
    <HermitVisual class="hermit-character" :percent="percent" :skin="state.settings.hermitSkin" :accessory="state.settings.hermitAccessory" :play="play" :now="now" :gentle="still" :paused="!visible || moving || !!panel" :interactive-accessory="!blocked && !mainAction" @accessory="act('accessory')"/>
    <button class="hermit-body-hit scene-hit" :disabled="blocked || play.action === 'tease'" :aria-label="play.action === 'sleep' ? '叫寄居蟹出来' : '敲敲寄居蟹的门'" @click="bodyClick"/>
    <button v-if="prop?.frame != null" class="hermit-door-prop" :aria-label="'碰碰' + prop.label" :disabled="blocked || mainAction" @click="act('accessory')"><HermitSprite prop :frame="prop.frame"/></button>
    <p v-if="!mainAction" class="hermit-speech">{{ speech }}</p>
    <span v-if="percent === 0 && !mainAction" class="hermit-closed-sign">今天不搬了</span>
    <button class="hermit-quota" :disabled="noticeOpen || calendarOpen" :aria-expanded="panel === 'details'" aria-label="查看寄居蟹额度详情" @click="togglePanel('details')"><CodexQuotaReadout compact><span>{{ quotaDisplay.label }}</span><strong>{{ percent === null ? '—' : Math.round(percent) + '%' }}</strong><small>{{ status }}</small></CodexQuotaReadout></button>
    <PetArcToolbar scene="hermit" label="纸箱寄居蟹" :blocked="noticeOpen || calendarOpen"><template #controls><button aria-label="寄居蟹更多玩法" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="寄居蟹换装" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhTShirt/></button><button aria-label="寄居蟹设置" @click="openSettings"><PhGearSix/></button><button aria-label="收起寄居蟹到托盘" @click="run(() => api.hide(), '收起失败，请重试。')"><PhMinus/></button></template><button v-for="item in HERMIT_ACTIONS.filter(item => item.id !== 'visit')" :key="item.id" :aria-label="'寄居蟹' + item.label" @click="act(item.id)"><component :is="icons[item.id]"/><span>{{ item.label }}</span></button></PetArcToolbar>
    <div v-if="play.action === 'tease'" ref="teaseArea" class="hermit-tease-area" data-pet-gesture role="group" aria-label="羽毛活动区，方向键移动，空格抓取" tabindex="0" @pointerdown.stop="featherDown" @pointermove.stop="featherMove" @pointerup.stop="featherUp" @pointercancel.stop="release" @lostpointercapture="release" @keydown="featherKey"><span class="hermit-catch-zone" :class="{ 'is-valid': inCatchZone(feather.x, feather.y) }"/><HermitSprite prop :frame="8" class="hermit-feather" :style="{ left: feather.x * 100 + '%', top: feather.y * 100 + '%' }"/></div>
    <div v-if="mainAction" class="hermit-hud" data-pet-gesture aria-live="polite"><div><b>{{ actionTitle }}</b><small>{{ actionHint }}</small></div><button v-if="play.action === 'tease'" :disabled="play.catches >= 3" @click="attempt()">递给它</button><button @click="cancel">{{ play.action === 'sleep' ? '叫它出来' : '结束' }}</button></div>
    <section v-if="panel" class="hermit-panel" data-pet-gesture role="dialog" :aria-label="panel === 'wardrobe' ? '寄居蟹衣橱' : panel === 'play' ? '寄居蟹玩法' : '寄居蟹额度详情'"><header><b>{{ panel === 'wardrobe' ? '挑个小家，慢慢试住' : panel === 'play' ? '陪小螃蟹玩一会儿' : '额度详情' }}</b><button aria-label="关闭寄居蟹面板" @click="closePanel"><PhX/></button></header><div class="hermit-panel-scroll"><HermitWardrobe v-if="panel === 'wardrobe'" @saved="closePanel"/><div v-else-if="panel === 'play'" class="hermit-play-options"><button v-for="item in HERMIT_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.id]"/><b>{{ item.label }}</b><small>{{ item.hint }}</small></button><p>互动只影响小螃蟹的动作，不改变真实额度。</p></div><QuotaDetails v-else/></div></section>
    <footer class="hermit-chrome"><span>{{ status }}</span><button :disabled="state.syncing || !quotaDisplay.canRefresh" aria-label="刷新寄居蟹额度" @click="run(() => api.refresh(), '刷新失败，请稍后重试。')"><PhArrowsClockwise/></button><button v-if="!usable" @click="run(() => api.login(), '连接窗口未能打开。')">连接账户</button></footer>
    <div v-if="notice" class="hermit-error" role="status" data-pet-gesture>{{ notice }}<button aria-label="关闭寄居蟹提示" @click="notice = ''"><PhX/></button></div>
    <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="hermit-resize" :class="corner" :aria-label="`缩放寄居蟹 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="run(() => api.settings({ windowWidth: state.settings.windowWidth + 10 }), '大小未能保存。')" @keydown.down.prevent="run(() => api.settings({ windowWidth: state.settings.windowWidth - 10 }), '大小未能保存。')"><PhArrowUpLeft/></button>
  </section>
  <aside v-if="!isDesktop" class="hermit-intro"><span>THE LITTLE HOME CLUB / 014</span><h1>小家不大，<br/>装得下<span>好心情。</span></h1><p>一只爱搬家、又认真护家的小螃蟹。<br/>敲敲门，试试新住处，陪它歇一会儿。</p><div><button @click="act('knock')"><PhHandWaving/>敲敲它的门</button><button @click="togglePanel('wardrobe')"><PhTShirt/>挑个新家</button></div><div><button @click="demoSource">{{ state.settings.quotaSource === 'codex' ? '恢复日常皮肤' : '预览 GPT 觉醒' }}</button><button aria-label="寄居蟹切换昼夜" @click="run(() => api.settings({ theme: night ? 'day' : 'night' }), '昼夜设置未能保存。')"><PhSun v-if="night"/><PhMoon v-else/></button></div><small>浏览器使用演示额度 · 原生客户端同步实际账户</small><div class="hermit-preview-levels"><button v-for="value in [100, 60, 30, 0]" :key="value" @click="previewQuota(value)">{{ value }}%</button><button @click="run(() => api.settings({ codexEnabled: false }), '预览设置失败')">断开觉醒</button></div></aside>
</div><section v-if="!isDesktop" class="hermit-preview-wardrobe"><header><span>MAKE YOURSELF AT HOME</span><h2>三套小家，六种模样。</h2><p>小套件可自由搭配；试住后点“住这里”才会保存。</p></header><HermitWardrobe/></section></div></template>
