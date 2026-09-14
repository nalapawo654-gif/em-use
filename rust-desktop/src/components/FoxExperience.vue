<script setup lang="ts">
import PetNotices from './PetNotices.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhHandPalm, PhNote, PhButterfly, PhSparkle, PhMoon, PhSun, PhGearSix, PhMinus, PhGameController, PhPalette, PhX, PhArrowsClockwise, PhArrowUpLeft, PhArrowRight } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import { FOX_ACTIONS, FOX_LEVELS, advanceFox, beginFox, foxIdle, foxLevel, foxPose, type FoxAction } from '../fox/play'
import FoxVisual from './FoxVisual.vue'
import FoxWardrobe from './FoxWardrobe.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), panel = ref<'play' | 'wardrobe' | 'details' | null>(null), notice = ref(''), play = ref(foxIdle()), visible = ref(!document.hidden)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const icons = { hand: PhHandPalm, paper: PhNote, butterfly: PhButterfly, sparkle: PhSparkle, moon: PhMoon }
const level = computed(() => foxLevel(props.percent)), active = computed(() => play.value.action !== 'idle')
const pose = computed(() => foxPose(props.percent, play.value.action))
const action = computed(() => FOX_ACTIONS.find(item => item.id === play.value.action))
const speech = computed(() => action.value?.speech ?? FOX_LEVELS[level.value].speech)
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '同步今日额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '正在连接' }[state.status]))
function focusWidget() { void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function act(value: FoxAction) { panel.value = null; notice.value = ''; play.value = beginFox(value, performance.now()); focusWidget() }
function cancel() { play.value = foxIdle(); focusWidget() }
function escape() { panel.value = null; notice.value = ''; cancel() }
function togglePanel(value: NonNullable<typeof panel.value>) { panel.value = panel.value === value ? null : value; notice.value = ''; if (!panel.value) focusWidget() }
function closePanel() { panel.value = null; focusWidget() }
async function perform(fn: () => Promise<unknown>, message: string) { try { await fn() } catch { notice.value = message } }
function demo(percent: number | null) { if (isDesktop) return; play.value = foxIdle(); if (percent === null) void api.logout(); else previewQuota(percent) }
function resetPlay() { play.value = foxIdle() }
function visibility() { visible.value = !document.hidden; if (!visible.value) resetPlay() }
watch(() => props.percent, (next, previous) => { if (visible.value && next !== null && previous !== null && previous <= 0 && next > 0 && !active.value && !panel.value) play.value = beginFox('bloom', performance.now()) })
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { if (visible.value) play.value = advanceFox(play.value, performance.now()) }, 100); document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', resetPlay) })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', resetPlay) })
</script>
<template>
  <div class="fox-experience" :class="{ 'fox-native': isDesktop }">
    <div class="fox-hero">
      <section ref="widget" tabindex="-1" class="fox-widget" :class="[{ 'has-panel': panel, 'has-action': active, 'has-notice': notice, 'is-moving': moving, 'is-paused': !visible }, `pose-${pose}`]" :style="{ '--fox-energy': FOX_LEVELS[level].color }" aria-label="水墨小狐场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <PetNotices :blocked="!!panel || active || moving || !!notice"/>
        <div class="fox-character"><FoxVisual :key="play.startedAt" :percent="percent" :action="play.action" :skin="state.settings.foxSkin" :gentle="state.settings.reducedMotion" :paused="!visible || moving" ambient :ambient-allowed="!panel && !active && !moving"/></div>
        <button class="fox-tail-hit scene-hit" aria-label="摸摸小狐狸尾巴" @click="act('tail')"></button>
        <button class="fox-body-hit scene-hit" :aria-label="play.action === 'rest' ? '叫小狐狸回来' : '点点小狐狸，追一只蝶'" @click="play.action === 'rest' ? cancel() : act('butterfly')"></button>
        <p class="fox-speech" aria-live="polite">{{ speech }}</p>
        <div class="fox-quota-wrap"><button class="fox-quota" :aria-expanded="panel === 'details'" :aria-label="`小狐狸今日剩余额度 ${percent === null ? '未知' : Math.round(percent) + '%'}，${statusLabel}`" @click="togglePanel('details')"><span>今日余墨</span><i class="fox-meter"><i :style="{ width: `${percent === null ? 0 : Math.max(0, Math.min(100, percent))}%` }"></i></i><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong></button><span class="fox-amount">{{ usable && state.quota ? `¥${state.quota.remaining.toFixed(2)} / ¥${state.quota.limit.toFixed(2)}` : statusLabel }}<em v-if="state.status === 'stale'"> · 数据待更新</em></span></div>
        <header class="fox-header fox-chrome"><b>水墨小狐 <i>狐</i></b><div><button aria-label="小狐狸更多玩法" title="更多玩法" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="小狐狸换墨色" title="换墨色" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhPalette/></button><button aria-label="小狐狸设置" title="设置" @click="emit('settings')"><PhGearSix/></button><button aria-label="收起小狐狸到托盘" title="收起到托盘" @click="perform(() => api.hide(), '收起失败，请重试。')"><PhMinus/></button></div></header>
        <nav class="fox-tools fox-chrome" aria-label="小狐狸常用互动"><button v-for="item in FOX_ACTIONS.slice(0, 3)" :key="item.id" :aria-label="'小狐狸' + item.label" @click="act(item.id)"><component :is="icons[item.icon]"/><span>{{ item.label }}</span></button></nav>
        <footer class="fox-footer fox-chrome"><button @click="togglePanel('details')"><i></i>{{ statusLabel }}</button><button aria-label="刷新小狐狸额度" :disabled="state.syncing || !state.quota" @click="perform(() => api.refresh(), '刷新失败，请稍后重试。')"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button><button v-if="!usable" :disabled="state.loginOpen" @click="emit('settings')">连接账户</button></footer>
        <div v-if="active" class="fox-hud" data-pet-gesture aria-live="polite"><span><b>{{ action?.label }}</b><small>{{ play.action === 'rest' ? '歇一歇，随时叫我回来。' : action?.hint }}</small></span><button :aria-label="play.action === 'rest' ? '小狐狸回来' : '结束小狐狸互动'" @click="cancel">{{ play.action === 'rest' ? '回来' : '结束' }}</button></div>
        <section v-if="panel" class="fox-panel" data-pet-gesture role="dialog" :aria-label="panel === 'play' ? '小狐狸玩法' : panel === 'wardrobe' ? '小狐狸墨色' : '小狐狸额度详情'"><header><b>{{ panel === 'play' ? '偷得浮生半日闲' : panel === 'wardrobe' ? '今天，用什么墨？' : '今日平台额度' }}</b><button aria-label="关闭小狐狸面板" @click="closePanel"><PhX/></button></header><template v-if="panel === 'play'"><div class="fox-play-grid"><button v-for="item in FOX_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.icon]"/><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span></button></div><p>互动只是陪伴，不改变真实 API 额度。</p></template><FoxWardrobe v-else-if="panel === 'wardrobe'"/><template v-else><p>{{ statusLabel }} · {{ state.message }}</p><dl v-if="state.quota"><div><dt>{{ usable ? '今日剩余' : '上次记录剩余' }}</dt><dd>¥{{ state.quota.remaining.toFixed(2) }}</dd></div><div><dt>每日额度</dt><dd>¥{{ state.quota.limit.toFixed(2) }}</dd></div><div><dt>费用日期</dt><dd>{{ state.quota.day }}</dd></div><div><dt>费用更新时间</dt><dd>{{ state.quota.estimatedAt.replace('T', ' ').slice(0, 19) }}</dd></div></dl><p>以平台返回的费用日期与金额为准；摸尾巴、留白和舒展都不会恢复额度。</p><button class="fox-link" @click="perform(() => api.openPortal(), '平台页面未能打开。')">前往平台核对 <PhArrowRight/></button></template></section>
        <div v-if="notice" class="fox-notice" data-pet-gesture role="status"><span>{{ notice }}</span><button aria-label="关闭小狐狸提示" @click="notice = ''"><PhX/></button></div>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="fox-resize" :class="corner" :aria-label="`缩放小狐狸 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="perform(() => api.settings({ windowWidth: state.settings.windowWidth + 10 }), '大小暂未保存。')" @keydown.down.prevent="perform(() => api.settings({ windowWidth: state.settings.windowWidth - 10 }), '大小暂未保存。')"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="fox-intro"><span class="fox-eyebrow">THE ART OF A LITTLE PAUSE</span><div class="fox-intro-title"><h1>水墨<br/>小狐<span>。</span></h1><span class="fox-seal">闲中有趣</span><p>不是消失，<br/>是留白。</p></div><p class="fox-intro-copy">一只从水墨里走来的小狐狸。<br/>以尾为笔，以墨作伴。陪你认真落笔，<br/>也陪你在忙碌的日子里，留一点自己。</p><div class="fox-preview-actions"><button @click="act('tail')"><PhHandPalm/>摸摸它的尾巴 <PhArrowRight/></button><button @click="perform(() => api.settings({ theme: night ? 'day' : 'night' }), '昼夜设置暂未保存。')"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '日光入墨' : '月下留白' }}</button></div><small>桌角新朋友 / 08 <i>·</i> 浏览器预览 · 演示额度</small></aside>
    </div>
    <template v-if="!isDesktop">
      <section class="fox-preview-section"><header><div><span>壹 / 墨有浓淡</span><h2>每一分余量，都有自己的模样。</h2></div><button class="fox-link" :aria-pressed="percent === null" @click="demo(null)">未知额度 · —</button></header><div class="fox-states"><button v-for="value in [100, 50, 20, 15]" :key="value" :aria-label="`预览小狐狸 ${value}%`" :aria-pressed="percent === value" @click="demo(value)"><div><FoxVisual :percent="value" :skin="state.settings.foxSkin" gentle paused/></div><span><i :style="{ background: FOX_LEVELS[foxLevel(value)].color }"></i><strong>{{ value }}<small>%</small></strong></span><b>{{ FOX_LEVELS[foxLevel(value)].label }}</b></button></div></section>
      <section class="fox-preview-section"><header><div><span>贰 / 闲来一笔</span><h2>小小互动，慢慢亲近。</h2></div><small>轻轻一点，让它回应你。</small></header><div class="fox-interactions"><button v-for="item in FOX_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.icon]"/><b>{{ item.label }}</b><small>{{ item.hint }}</small><PhArrowRight/></button></div></section>
      <section class="fox-preview-section"><header><div><span>叁 / 今日墨色</span><h2>一抹墨色，一种心境。</h2></div><small>配色独立保存</small></header><FoxWardrobe/></section>
      <footer class="fox-preview-footer"><span>水墨小狐 <i>·</i> 小小一团墨，也是完整的自己。</span><span class="fox-seal">留白</span><span>A little ink. A little peace.</span></footer>
    </template>
  </div>
</template>
