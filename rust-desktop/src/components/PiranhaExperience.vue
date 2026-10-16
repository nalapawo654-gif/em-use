<script setup lang="ts">
import PetEvolution from './PetEvolution.vue'
import QuotaDetails from './QuotaDetails.vue'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { PhPlant, PhGearSix, PhMinus, PhGameController, PhTShirt, PhX, PhArrowsClockwise, PhArrowUpLeft, PhSun, PhMoon, PhArrowRight, PhHeart, PhFlower, PhEnvelopeSimple, PhCalendarBlank, PhNote } from '@phosphor-icons/vue'
import { api, quotaState as state, quotaDisplay, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import { PIRANHA_ACTIONS, PIRANHA_MOODS, piranhaLevel, piranhaIdle, beginPiranha, advancePiranha, type PiranhaAction } from '../piranha/play'
import PiranhaVisual from './PiranhaVisual.vue'
import PiranhaSprite from './PiranhaSprite.vue'
import PiranhaWardrobe from './PiranhaWardrobe.vue'
import PetNotices from './PetNotices.vue'
import PetCalendar from './PetCalendar.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), panel = ref<'play' | 'wardrobe' | 'details' | null>(null), notice = ref('')
const play = ref(piranhaIdle()), clock = ref(performance.now()), visible = ref(!document.hidden)
const calendarOpen = ref(false), noticeOpen = ref(false)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const active = computed(() => play.value.action !== 'idle')
const level = computed(() => piranhaLevel(props.percent))
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '正在同步额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '等待登录' }[state.status]))
const speech = computed(() => active.value ? ({ feed: '啊呜！这张纸条，我替你嚼嚼。', bloom: '被你一夸，快乐都开花啦。', tease: '哼！才没有那么简单呢。', pet: '花瓣软软的，心也软软的。', sleep: '闭一会儿眼，休息也算正经事。', idle: '' }[play.value.action]) : PIRANHA_MOODS[level.value].speech)
const icons = { feed: PhNote, bloom: PhFlower, tease: PhGameController, pet: PhHeart, sleep: PhMoon }
const samples = [{ percent: 100, label: '花稳稳满' }, { percent: 75, label: '等一口需求' }, { percent: 50, label: '蔫了，歇歇' }, { percent: 25, label: '合苞休息' }]
function focus() { void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function act(action: PiranhaAction) { panel.value = null; notice.value = ''; clock.value = performance.now(); play.value = beginPiranha(action, clock.value); focus() }
function cancel() { play.value = piranhaIdle(); focus() }
function escape() { panel.value = null; notice.value = ''; cancel() }
function togglePanel(value: NonNullable<typeof panel.value>) { play.value = piranhaIdle(); panel.value = panel.value === value ? null : value; notice.value = ''; if (!panel.value) focus() }
function closePanel() { panel.value = null; focus() }
async function run(task: () => Promise<unknown>, failure: string, preview = '') { try { await task(); if (!isDesktop && preview) notice.value = preview } catch { notice.value = failure } }
function settings() { escape(); emit('settings') }
function demo(percent: number | null) { if (isDesktop) return; escape(); if (percent === null) void api.logout(); else previewQuota(percent) }
function pause() { if (play.value.action !== 'sleep') play.value = piranhaIdle() }
function visibility() { visible.value = !document.hidden; if (!visible.value) pause() }
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { if (!visible.value || !active.value || play.value.action === 'sleep') return; clock.value = performance.now(); play.value = advancePiranha(play.value, clock.value) }, 80); document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', pause) })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', pause) })
</script>
<template>
  <div class="piranha-experience" :class="{ 'piranha-native': isDesktop }">
    <div class="piranha-hero">
      <section ref="widget" tabindex="-1" class="piranha-widget" :class="{ 'has-panel': panel, 'has-action': active, 'has-notice': notice, 'is-moving': moving, 'calendar-is-open': calendarOpen, 'piranha-notice-open': noticeOpen, 'piranha-gentle': state.settings.reducedMotion }" aria-label="食人花场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <PetEvolution :blocked="!!panel || active || moving || !!notice || calendarOpen || noticeOpen"/><PetNotices :blocked="!!panel || active || moving || !!notice" :message-blocked="!!panel || moving || !!notice" :message-deferred="active" :external-blocked="calendarOpen" :external-deferred="!!state.calendar?.active.length" @open-change="noticeOpen = $event"><template #parcel><PiranhaSprite class="message-prop-motion" :frame="13"/></template></PetNotices>
        <PetCalendar appearance="piranha" :blocked="!!panel || moving || !!notice || noticeOpen || active" @open-change="calendarOpen = $event"/>
        <PiranhaVisual class="piranha-character" retryable :percent="percent" :skin="state.settings.piranhaSkin" :action="play.action" :elapsed="clock - play.started" :gentle="state.settings.reducedMotion" :paused="!visible || moving"/>
        <button class="piranha-body-hit scene-hit" :disabled="!!panel || noticeOpen || calendarOpen" :aria-label="play.action === 'sleep' ? '叫食人花起床' : '摸摸食人花花冠'" @click="play.action === 'sleep' ? cancel() : act('pet')"></button>
        <p v-if="!active" class="piranha-speech" aria-live="polite">{{ speech }}</p>
        <button class="piranha-quota" :class="['quota-' + level, { 'quota-stale': state.status === 'stale' }]" :disabled="noticeOpen || calendarOpen" :aria-expanded="panel === 'details'" :aria-label="`食人花剩余额度 ${percent === null ? '未知' : Math.round(percent) + '%'}，${statusLabel}`" @click="togglePanel('details')"><span>{{ quotaDisplay.label }}</span><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong><small>{{ state.status === 'stale' || percent === null ? statusLabel : quotaDisplay.percent !== null ? quotaDisplay.subtitle : statusLabel }}</small></button>
        <header class="piranha-header piranha-chrome"><span><PhPlant weight="duotone"/><b>捕需求草</b></span><div><button aria-label="食人花更多玩法" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="食人花换装" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhTShirt/></button><button aria-label="食人花设置" @click="settings"><PhGearSix/></button><button aria-label="收起食人花到托盘" @click="run(() => api.hide(), '收起失败，请重试。', '桌面版可收起到系统托盘。')"><PhMinus/></button></div></header>
        <nav class="piranha-tools piranha-chrome" aria-label="食人花常用互动"><button v-for="item in PIRANHA_ACTIONS.filter(a => ['feed', 'bloom', 'pet'].includes(a.id))" :key="item.id" :aria-label="'食人花' + item.label" @click="act(item.id)"><component :is="icons[item.id]"/><span>{{ item.label }}</span></button></nav>
        <footer class="piranha-footer piranha-chrome"><button @click="togglePanel('details')">{{ statusLabel }}</button><button aria-label="刷新食人花额度" :disabled="state.syncing || !quotaDisplay.canRefresh" @click="run(() => api.refresh(), '刷新失败，请稍后重试。')"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button><button v-if="!usable" :disabled="state.loginOpen" @click="run(() => api.login(), '登录窗口未能打开，请重试。', '请在桌面客户端连接账户。')">{{ state.loginOpen ? '等待登录' : '连接账户' }}</button></footer>
        <div v-if="active" class="piranha-hud" data-pet-gesture aria-live="polite"><div><b>{{ PIRANHA_ACTIONS.find(a => a.id === play.action)?.label }}</b><small>{{ speech }}</small></div><button @click="cancel">{{ play.action === 'sleep' ? '起床' : '结束' }}</button></div>
        <section v-if="panel" class="piranha-panel" data-pet-gesture role="dialog" :aria-label="panel === 'wardrobe' ? '食人花衣橱' : panel === 'play' ? '食人花玩法' : '食人花额度详情'"><header><b>{{ panel === 'wardrobe' ? '一盆花，四季好心情。' : panel === 'play' ? '陪小花，歇一会儿。' : '额度详情' }}</b><button aria-label="关闭食人花面板" @click="closePanel"><PhX/></button></header><div class="piranha-panel-scroll"><PiranhaWardrobe v-if="panel === 'wardrobe'"/><template v-else-if="panel === 'play'"><div class="piranha-play-grid"><button v-for="item in PIRANHA_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.id]"/><b>{{ item.label }}</b><small>{{ item.hint }}</small></button></div><p>纸条是小花的虚构零食。互动不会消耗或恢复真实额度。</p></template><template v-else><QuotaDetails/></template></div></section>
        <div v-if="notice" class="piranha-notice" data-pet-gesture role="status"><span>{{ notice }}</span><button aria-label="关闭食人花提示" @click="notice = ''"><PhX/></button></div>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="piranha-resize" :class="corner" :aria-label="`缩放食人花 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="run(() => api.settings({ windowWidth: state.settings.windowWidth + 10 }), '大小未能保存。')" @keydown.down.prevent="run(() => api.settings({ windowWidth: state.settings.windowWidth - 10 }), '大小未能保存。')"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="piranha-intro"><span class="piranha-eyebrow">DESK BOTANICALS / 012</span><h1>吃掉小烦恼，<br/><em>长出好心情。</em></h1><p>一盆看起来大嘴无情的小花，<br/>其实最喜欢的，是你停下来陪它一会儿。</p><div class="piranha-intro-actions"><button @click="act('feed')"><PhNote/>投喂一条需求<PhArrowRight/></button><button aria-label="切换食人花昼夜" @click="run(() => api.settings({ theme: night ? 'day' : 'night' }), '昼夜设置未能保存。')"><PhSun v-if="night"/><PhMoon v-else/></button></div><small>浏览器演示额度 · 桌面版连接账户后同步真实数据</small><span class="piranha-handwriting">“吃下去的不是需求，是快乐。”</span></aside>
    </div>
    <template v-if="!isDesktop">
      <section class="piranha-preview-section"><header><div><span>01 / 一盆花的能量日记</span><h2>有精神，就开花。累了，就合苞。</h2></div><button @click="demo(null)">预览未连接 · —</button></header><div class="piranha-states"><button v-for="sample in samples" :key="sample.percent" :aria-pressed="percent === sample.percent" @click="demo(sample.percent)"><strong>{{ sample.percent }}<small>%</small></strong><PiranhaVisual :percent="sample.percent" :skin="state.settings.piranhaSkin" gentle/><b>{{ sample.label }}</b></button></div></section>
      <section class="piranha-preview-section"><header><div><span>02 / 桌角的小小陪伴</span><h2>它记得赴约，也替你接住来信。</h2></div></header><div class="piranha-prop-stories"><article><PiranhaSprite :frame="12"/><div><PhCalendarBlank/><h3>叶片翻页历</h3><p>盆边翻一页，看看今天的安排。到点时轻轻提醒，忙碌时安静等待。</p></div></article><article><PiranhaSprite :frame="13"/><div><PhEnvelopeSimple/><h3>藤蔓来信</h3><p>绿叶托住新消息，桃花封好小信封。看完提醒，它就收起信件。</p></div></article></div></section>
      <section class="piranha-preview-section"><header><div><span>03 / 今天，想开哪朵花</span><h2>同一盆小可爱，五种小性格。</h2></div></header><PiranhaWardrobe/></section>
      <footer class="piranha-preview-footer"><PhPlant/>需求慢慢来，花儿慢慢开。<span>EM USE · A LITTLE JOY ON YOUR DESK</span></footer>
    </template>
  </div>
</template>
