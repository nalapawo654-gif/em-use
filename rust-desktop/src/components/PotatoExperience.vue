<script setup lang="ts">
import PetEvolution from './PetEvolution.vue'
import QuotaDetails from './QuotaDetails.vue'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { PhGearSix, PhMinus, PhGameController, PhTShirt, PhX, PhArrowsClockwise, PhArrowUpLeft, PhSun, PhMoon, PhArrowRight, PhHeart, PhEnvelopeSimple, PhCalendarBlank, PhRobot, PhCoffee, PhCalculator, PhShield, PhFlag, PhWrench } from '@phosphor-icons/vue'
import { api, quotaState as state, quotaDisplay, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import { POTATO_ACTIONS, POTATO_MOODS, potatoLevel, potatoIdle, beginPotato, advancePotato, tapPotato, type PotatoAction } from '../potato/play'
import PotatoVisual from './PotatoVisual.vue'
import PotatoSprite from './PotatoSprite.vue'
import PotatoWardrobe from './PotatoWardrobe.vue'
import PetNotices from './PetNotices.vue'
import PetCalendar from './PetCalendar.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), panel = ref<'play' | 'wardrobe' | 'details' | null>(null), notice = ref('')
const play = ref(potatoIdle()), clock = ref(performance.now()), visible = ref(!document.hidden)
const calendarOpen = ref(false), noticeOpen = ref(false)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const active = computed(() => play.value.action !== 'idle')
const level = computed(() => potatoLevel(props.percent))
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '正在同步额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '等待登录' }[state.status]))
const speech = computed(() => play.value.completedAt !== null ? (play.value.action === 'repair' ? '三处连接检查完成，机甲稳稳当当。' : '小账算清啦，真实额度还是原来的数。') : active.value ? ({ coffee: '咖啡续的是心情，额度还是看平台。', calculate: `虚构小账 ${play.value.steps}/3 · 点下面的算盘`, shield: '锅盖盾已装备，气势再加一点点。', cheer: '加油！这一小步，已经很了不起。', tease: '哼哼，看我的土豆小碎步。', pet: '头盔下面，是一颗软乎乎的土豆。', repair: `连接检查 ${play.value.steps}/3 · 点下面的扳手`, idle: '' }[play.value.action]) : POTATO_MOODS[level.value].speech)
const icons = { coffee: PhCoffee, calculate: PhCalculator, shield: PhShield, cheer: PhFlag, tease: PhGameController, pet: PhHeart, repair: PhWrench }
const samples = [{ percent: 100, label: '豪华机甲' }, { percent: 75, label: '部分损耗' }, { percent: 50, label: '胶带机甲' }, { percent: 25, label: '纸箱机甲' }]
function focus() { void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function act(action: PotatoAction) { panel.value = null; notice.value = ''; clock.value = performance.now(); play.value = beginPotato(action, clock.value); focus() }
function cancel() { play.value = potatoIdle(); focus() }
function escape() { panel.value = null; notice.value = ''; cancel() }
function togglePanel(value: NonNullable<typeof panel.value>) { play.value = potatoIdle(); panel.value = panel.value === value ? null : value; notice.value = ''; if (!panel.value) focus() }
function closePanel() { panel.value = null; focus() }
async function run(task: () => Promise<unknown>, failure: string, preview = '') { try { await task(); if (!isDesktop && preview) notice.value = preview } catch { notice.value = failure } }
function settings() { escape(); emit('settings') }
function demo(percent: number | null) { if (isDesktop) return; escape(); if (percent === null) void api.logout(); else previewQuota(percent) }
function pause() { if (play.value.action !== 'shield') play.value = potatoIdle() }
function progress() { clock.value = performance.now(); play.value = tapPotato(play.value, clock.value) }
function visibility() { visible.value = !document.hidden; if (!visible.value) pause() }
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { if (!visible.value || !active.value || play.value.action === 'shield') return; clock.value = performance.now(); play.value = advancePotato(play.value, clock.value) }, 80); document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', pause) })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', pause) })
</script>
<template>
  <div class="potato-experience" :class="{ 'potato-native': isDesktop }">
    <div class="potato-hero">
      <section ref="widget" tabindex="-1" class="potato-widget" :class="{ 'has-panel': panel, 'has-action': active, 'has-notice': notice, 'is-moving': moving, 'calendar-is-open': calendarOpen, 'potato-notice-open': noticeOpen, 'potato-gentle': state.settings.reducedMotion }" aria-label="土豆战神场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <PetEvolution :blocked="!!panel || active || moving || !!notice || calendarOpen || noticeOpen"/><PetNotices :blocked="!!panel || active || moving || !!notice" :message-blocked="!!panel || moving || !!notice" :message-deferred="active" :external-blocked="calendarOpen" :external-deferred="!!state.calendar?.active.length" @open-change="noticeOpen = $event"><template #parcel><PotatoSprite class="message-prop-motion" atlas="props" :frame="1"/></template></PetNotices>
        <PetCalendar appearance="potato" :blocked="!!panel || moving || !!notice || noticeOpen || active" @open-change="calendarOpen = $event"/>
        <PotatoVisual class="potato-character" retryable :percent="percent" :skin="state.settings.potatoSkin" :action="play.action" :elapsed="clock - play.started" :steps="play.steps" :gentle="state.settings.reducedMotion" :paused="!visible || moving"/>
        <button class="potato-body-hit scene-hit" :disabled="!!panel || noticeOpen || calendarOpen" :aria-label="play.action === 'shield' ? '卸下土豆战神锅盖' : '摸摸土豆战神头盔'" @click="play.action === 'shield' ? cancel() : act('pet')"></button>
        <p v-if="!active" class="potato-speech" aria-live="polite">{{ speech }}</p>
        <button class="potato-quota" :class="['quota-' + level, { 'quota-stale': state.status === 'stale' }]" :disabled="noticeOpen || calendarOpen" :aria-expanded="panel === 'details'" :aria-label="`土豆战神剩余额度 ${percent === null ? '未知' : Math.round(percent) + '%'}，${statusLabel}`" @click="togglePanel('details')"><span>{{ quotaDisplay.label }}</span><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong><small>{{ state.status === 'stale' || percent === null ? statusLabel : quotaDisplay.percent !== null ? quotaDisplay.subtitle : statusLabel }}</small></button>
        <header class="potato-header potato-chrome"><span><PhRobot weight="duotone"/><b>经费战神</b></span><div><button aria-label="土豆战神更多玩法" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="土豆战神换装" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhTShirt/></button><button aria-label="土豆战神设置" @click="settings"><PhGearSix/></button><button aria-label="收起土豆战神到托盘" @click="run(() => api.hide(), '收起失败，请重试。', '桌面版可收起到系统托盘。')"><PhMinus/></button></div></header>
        <nav class="potato-tools potato-chrome" aria-label="土豆战神常用互动"><button v-for="item in POTATO_ACTIONS.filter(a => ['coffee', 'cheer', 'pet'].includes(a.id))" :key="item.id" :aria-label="'土豆战神' + item.label" @click="act(item.id)"><component :is="icons[item.id]"/><span>{{ item.label }}</span></button></nav>
        <footer class="potato-footer potato-chrome"><button @click="togglePanel('details')">{{ statusLabel }}</button><button aria-label="刷新土豆战神额度" :disabled="state.syncing || !quotaDisplay.canRefresh" @click="run(() => api.refresh(), '刷新失败，请稍后重试。')"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button><button v-if="!usable" :disabled="state.loginOpen" @click="run(() => api.login(), '登录窗口未能打开，请重试。', '请在桌面客户端连接账户。')">{{ state.loginOpen ? '等待登录' : '连接账户' }}</button></footer>
        <button v-if="['calculate', 'repair'].includes(play.action)" class="potato-progress" data-pet-gesture :disabled="play.completedAt !== null" @click="progress"><PotatoSprite atlas="props" :frame="play.action === 'repair' ? 6 : 7"/><span>{{ play.completedAt !== null ? '完成！' : (play.action === 'repair' ? '拧紧' : '算一笔') + ' ' + play.steps + '/3' }}</span></button>
        <div v-if="active" class="potato-hud" data-pet-gesture aria-live="polite"><div><b>{{ POTATO_ACTIONS.find(a => a.id === play.action)?.label }}</b><small>{{ speech }}</small></div><button @click="cancel">{{ play.action === 'shield' ? '卸下' : '结束' }}</button></div>
        <section v-if="panel" class="potato-panel" data-pet-gesture role="dialog" :aria-label="panel === 'wardrobe' ? '土豆战神衣橱' : panel === 'play' ? '土豆战神玩法' : '土豆战神额度详情'"><header><b>{{ panel === 'wardrobe' ? '20 款装备，随时出击。' : panel === 'play' ? '机库小事，陪你歇会儿。' : '额度详情' }}</b><button aria-label="关闭土豆战神面板" @click="closePanel"><PhX/></button></header><div class="potato-panel-scroll"><PotatoWardrobe v-if="panel === 'wardrobe'"/><template v-else-if="panel === 'play'"><div class="potato-play-grid"><button v-for="item in POTATO_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.id]"/><b>{{ item.label }}</b><small>{{ item.hint }}</small></button></div><p>算账、维修和装备都是陪伴互动，不会消耗或恢复真实额度。</p></template><template v-else><QuotaDetails/></template></div></section>
        <div v-if="notice" class="potato-notice" data-pet-gesture role="status"><span>{{ notice }}</span><button aria-label="关闭土豆战神提示" @click="notice = ''"><PhX/></button></div>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="potato-resize" :class="corner" :aria-label="`缩放土豆战神 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="run(() => api.settings({ windowWidth: state.settings.windowWidth + 10 }), '大小未能保存。')" @keydown.down.prevent="run(() => api.settings({ windowWidth: state.settings.windowWidth - 10 }), '大小未能保存。')"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="potato-intro"><span class="potato-eyebrow">POTATO POWER / 013</span><h1>装备可以没，<br/><em>气势不能输。</em></h1><p>一颗普通土豆，二十种出场方式。<br/>从全装机甲到纸箱战衣，都认真陪你守好工位。</p><div class="potato-intro-actions"><button @click="act('cheer')"><PhFlag/>为今天加把劲<PhArrowRight/></button><button aria-label="切换土豆战神昼夜" @click="run(() => api.settings({ theme: night ? 'day' : 'night' }), '昼夜设置未能保存。')"><PhSun v-if="night"/><PhMoon v-else/></button></div><small>浏览器演示额度 · 桌面版连接账户后同步真实数据</small><span class="potato-handwriting">“生活不止 KPI，还有机甲和土豆。”</span></aside>
    </div>
    <template v-if="!isDesktop">
      <section class="potato-preview-section"><header><div><span>01 / 经费作战记录</span><h2>经费会变，战斗的心不会。</h2></div><button @click="demo(null)">预览未连接 · —</button></header><div class="potato-states"><button v-for="sample in samples" :key="sample.percent" :aria-pressed="percent === sample.percent" @click="demo(sample.percent)"><strong>{{ sample.percent }}<small>%</small></strong><PotatoVisual :percent="sample.percent" :skin="state.settings.potatoSkin" gentle/><b>{{ sample.label }}</b></button></div></section>
      <section class="potato-preview-section"><header><div><span>02 / 工位后勤部</span><h2>日程准点到，来信稳稳接。</h2></div></header><div class="potato-prop-stories"><article><PotatoSprite atlas="props" :frame="0"/><div><PhCalendarBlank/><h3>机甲日程终端</h3><p>机库终端显示下一项安排。到点轻轻亮起，忙碌时安静待命。</p></div></article><article><PotatoSprite atlas="props" :frame="1"/><div><PhEnvelopeSimple/><h3>土豆通信信标</h3><p>落在机甲脚边的小信标。新消息点亮信号灯，查看后安静收起。</p></div></article></div></section>
      <section class="potato-preview-section"><header><div><span>03 / 机库休息时间</span><h2>战神也有七件小乐事。</h2></div></header><div class="potato-interaction-previews"><button v-for="item in POTATO_ACTIONS" :key="item.id" @click="act(item.id)"><PotatoSprite atlas="props" :frame="item.prop"/><b>{{ item.label }}</b><small>{{ item.hint }}</small></button></div></section>
      <section class="potato-preview-section"><header><div><span>04 / 全装机库 · 20 款</span><h2>每一套，都有完整的四种形态。</h2></div></header><PotatoWardrobe/></section>
      <footer class="potato-preview-footer"><PhRobot/>土豆会变，陪伴不会。<span>EM USE · A LITTLE JOY ON YOUR DESK</span></footer>
    </template>
  </div>
</template>
