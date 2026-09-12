<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { PhHeart, PhCoffee, PhCookie, PhHandPalm, PhLaptop, PhSparkle, PhMoon, PhSun, PhGearSix, PhMinus, PhGameController, PhTShirt, PhX, PhArrowsClockwise, PhArrowUpLeft, PhArrowRight } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import { FEIDUDU_ACTIONS, FEIDUDU_LEVELS, advanceFeidudu, beginFeidudu, feiduduIdle, feiduduLevel, feiduduFrame, type FeiduduAction } from '../feidudu/play'
import FeiduduVisual from './FeiduduVisual.vue'
import FeiduduWardrobe from './FeiduduWardrobe.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), panel = ref<'play' | 'wardrobe' | 'details' | null>(null), notice = ref(''), play = ref(feiduduIdle()), visible = ref(!document.hidden)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const icons = { heart: PhHeart, tea: PhCoffee, cookie: PhCookie, hand: PhHandPalm, work: PhLaptop, sparkle: PhSparkle, moon: PhMoon }
const quick = FEIDUDU_ACTIONS.filter(item => ['tea', 'cookie', 'belly', 'work'].includes(item.id))
const level = computed(() => feiduduLevel(props.percent)), active = computed(() => play.value.action !== 'idle')
const action = computed(() => FEIDUDU_ACTIONS.find(item => item.id === play.value.action))
const speech = computed(() => action.value?.speech ?? FEIDUDU_LEVELS[level.value].speech)
const lying = computed(() => [3, 4, 7].includes(feiduduFrame(props.percent, play.value.action)))
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '同步今日额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '正在连接' }[state.status]))
function focusWidget() {
  void nextTick(() => {
    const element = widget.value
    element?.focus({ preventScroll: true })
    if (!isDesktop && element) {
      const box = element.getBoundingClientRect()
      if (box.bottom < 0 || box.top > window.innerHeight) element.scrollIntoView({ behavior: state.settings.reducedMotion ? 'instant' : 'smooth', block: 'center' })
    }
  })
}
function act(value: FeiduduAction) { panel.value = null; notice.value = ''; play.value = beginFeidudu(value, performance.now()); focusWidget() }
function cancel() { play.value = feiduduIdle(); focusWidget() }
function escape() { panel.value = null; notice.value = ''; cancel() }
function pet() { if (play.value.action === 'rest') cancel(); else act('pet') }
function togglePanel(value: NonNullable<typeof panel.value>) { panel.value = panel.value === value ? null : value; notice.value = ''; if (!panel.value) focusWidget() }
function closePanel() { panel.value = null; focusWidget() }
async function perform(fn: () => Promise<unknown>, error: string) { try { await fn() } catch { notice.value = error } }
function demo(percent: number | null) { if (isDesktop) return; play.value = feiduduIdle(); if (percent === null) void api.logout(); else previewQuota(percent) }
function visibility() { visible.value = !document.hidden; if (!visible.value) clearShortAction() }
function clearShortAction() { if (action.value?.duration != null) play.value = feiduduIdle() }
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { if (visible.value) play.value = advanceFeidudu(play.value, performance.now()) }, 100); document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', clearShortAction) })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', clearShortAction) })
</script>
<template>
  <div class="feidudu-experience" :class="{ 'feidudu-native': isDesktop }">
    <div class="feidudu-hero">
      <section ref="widget" tabindex="-1" class="feidudu-widget" :class="{ 'has-panel': panel, 'has-action': active, 'has-notice': notice, 'is-moving': moving, 'is-paused': !visible }" :style="{ '--dudu-energy': FEIDUDU_LEVELS[level].color }" aria-label="肥嘟嘟场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <div class="feidudu-character"><FeiduduVisual :percent="percent" :action="play.action" :skin="state.settings.feiduduSkin" :gentle="state.settings.reducedMotion" :paused="!visible" :ambient="!panel && !active && !moving"/></div>
        <button class="feidudu-body-hit scene-hit" :class="{ lying }" :aria-label="play.action === 'rest' ? '叫肥嘟嘟起床' : '摸摸肥嘟嘟的头'" @click="pet"></button>
        <p class="feidudu-speech" aria-live="polite">{{ speech }}<PhHeart v-if="play.action === 'pet' || play.action === 'belly'" weight="fill"/></p>
        <span v-if="play.action === 'rest'" class="feidudu-zzz" aria-hidden="true">z Z</span>
        <div class="feidudu-quota-wrap"><button class="feidudu-quota" :aria-expanded="panel === 'details'" :aria-label="`肥嘟嘟今日剩余额度 ${percent === null ? '未知' : Math.round(percent) + '%'}，${statusLabel}`" @click="togglePanel('details')"><span>今日剩余</span><i class="feidudu-meter"><i :style="{ width: `${percent === null ? 0 : Math.max(0, Math.min(100, percent))}%` }"></i></i><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong></button><span class="feidudu-amount">{{ usable && state.quota ? `¥${state.quota.remaining.toFixed(2)} / ¥${state.quota.limit.toFixed(2)}` : statusLabel }}<em v-if="state.status === 'stale'"> · 数据待更新</em></span></div>
        <header class="feidudu-header feidudu-chrome"><b><PhHeart weight="duotone"/>肥嘟嘟</b><div><button aria-label="肥嘟嘟更多玩法" title="更多玩法" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="肥嘟嘟换装" title="换装" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhTShirt/></button><button aria-label="肥嘟嘟设置" title="设置" @click="emit('settings')"><PhGearSix/></button><button aria-label="收起肥嘟嘟到托盘" title="收起到托盘" @click="perform(() => api.hide(), '收起失败，请重试。')"><PhMinus/></button></div></header>
        <nav class="feidudu-tools feidudu-chrome" aria-label="肥嘟嘟常用互动"><button v-for="item in quick" :key="item.id" :aria-label="'肥嘟嘟' + item.label" @click="act(item.id)"><component :is="icons[item.icon]" weight="duotone"/><span>{{ item.label }}</span></button></nav>
        <footer class="feidudu-footer feidudu-chrome"><button @click="togglePanel('details')"><i></i>{{ statusLabel }}</button><button aria-label="刷新肥嘟嘟额度" :disabled="state.syncing || !state.quota" @click="perform(() => api.refresh(), '刷新失败，请稍后重试。')"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button><button v-if="!usable" :disabled="state.loginOpen" @click="emit('settings')">连接账户</button></footer>
        <div v-if="active" class="feidudu-hud" data-pet-gesture aria-live="polite"><span><b>{{ action?.label }}</b><small>{{ play.action === 'work' ? '你忙你的，我在这里。' : play.action === 'rest' ? '好好休息，随时叫我。' : '一点小快乐，正在发生。' }}</small></span><button :aria-label="play.action === 'rest' ? '肥嘟嘟起床' : '结束肥嘟嘟互动'" @click="cancel">{{ play.action === 'rest' ? '起床' : play.action === 'work' ? '结束陪伴' : '结束' }}</button></div>
        <section v-if="panel" class="feidudu-panel" data-pet-gesture role="dialog" :aria-label="panel === 'play' ? '肥嘟嘟玩法' : panel === 'wardrobe' ? '肥嘟嘟衣橱' : '肥嘟嘟额度详情'"><header><b>{{ panel === 'play' ? '和圆圆的快乐待一会儿' : panel === 'wardrobe' ? '今天，是什么口味？' : '今日平台额度' }}</b><button aria-label="关闭肥嘟嘟面板" @click="closePanel"><PhX/></button></header><template v-if="panel === 'play'"><div class="feidudu-play-grid"><button v-for="item in FEIDUDU_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.icon]" weight="duotone"/><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span></button></div><p>互动只是陪伴，不改变真实 API 额度。</p></template><FeiduduWardrobe v-else-if="panel === 'wardrobe'"/><template v-else><p>{{ statusLabel }} · {{ state.message }}</p><dl v-if="state.quota"><div><dt>{{ usable ? '今日剩余' : '上次记录剩余' }}</dt><dd>¥{{ state.quota.remaining.toFixed(2) }}</dd></div><div><dt>每日额度</dt><dd>¥{{ state.quota.limit.toFixed(2) }}</dd></div><div><dt>费用日期</dt><dd>{{ state.quota.day }}</dd></div><div><dt>费用更新时间</dt><dd>{{ state.quota.estimatedAt.replace('T', ' ').slice(0, 19) }}</dd></div></dl><p>以平台返回的费用日期与金额为准；摸摸、零食和休息不会恢复额度。</p><button class="feidudu-link" @click="perform(() => api.openPortal(), '平台页面未能打开。')">前往平台核对 <PhArrowRight/></button></template></section>
        <div v-if="notice" class="feidudu-notice" data-pet-gesture role="status"><span>{{ notice }}</span><button aria-label="关闭肥嘟嘟提示" @click="notice = ''"><PhX/></button></div>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="feidudu-resize" :class="corner" :aria-label="`缩放肥嘟嘟 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="perform(() => api.settings({ windowWidth: state.settings.windowWidth + 10 }), '大小暂未保存。')" @keydown.down.prevent="perform(() => api.settings({ windowWidth: state.settings.windowWidth - 10 }), '大小暂未保存。')"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="feidudu-intro"><span class="feidudu-eyebrow">A LITTLE ROUND · A LOT OF JOY</span><span class="feidudu-edition">桌角新朋友 / 07</span><h1>上班很苦，<br/>但我<span>很圆。</span></h1><p>你的胆子真是肥嘟嘟的。<br/>陪你认真开工，也陪你理直气壮地歇一会儿。</p><div class="feidudu-signature">不管电量多少，我都在你身边。<PhHeart weight="fill"/></div><div class="feidudu-preview-actions"><button @click="act('pet')"><PhHandPalm/>摸摸它的小脑袋 <PhArrowRight/></button><button @click="perform(() => api.settings({ theme: night ? 'day' : 'night' }), '昼夜设置暂未保存。')"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '晴朗白天' : '夜晚陪伴' }}</button></div><small>浏览器外观预览 · 演示额度</small></aside>
    </div>
    <template v-if="!isDesktop">
      <section class="feidudu-preview-section"><header><div><span>01 / 今天，还能撑多久？</span><h2>从元气满满，到软成一张饼。</h2></div><button class="feidudu-link" :aria-pressed="percent === null" @click="demo(null)">未知额度 · —</button></header><div class="feidudu-states"><button v-for="value in [100, 70, 50, 20, 15]" :key="value" :aria-label="`预览肥嘟嘟 ${value}% · ${FEIDUDU_LEVELS[feiduduLevel(value)].label}`" :aria-pressed="percent === value" @click="demo(value)"><div><FeiduduVisual :percent="value" :skin="state.settings.feiduduSkin" gentle/></div><span><i :style="{ background: FEIDUDU_LEVELS[feiduduLevel(value)].color }"></i><strong>{{ value }}<small>%</small></strong></span><b>{{ FEIDUDU_LEVELS[feiduduLevel(value)].label }}</b></button></div></section>
      <section class="feidudu-preview-section"><header><div><span>02 / 快乐，其实很具体</span><h2>给平平无奇的一天，加点料。</h2></div><small>点一下，去桌角陪它玩。</small></header><div class="feidudu-interactions"><button v-for="item in FEIDUDU_ACTIONS" :key="item.id" @click="act(item.id)"><div><FeiduduVisual :frame="item.frame" :skin="state.settings.feiduduSkin" gentle/></div><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span><PhArrowRight/></button></div></section>
      <section class="feidudu-preview-section feidudu-preview-wardrobe"><header><div><span>03 / 圆圆的，不止一种快乐</span><h2>选一份今天的甜。</h2></div><small>独立保存 · 随时换口味</small></header><FeiduduWardrobe/></section>
      <footer class="feidudu-preview-footer"><span>肥嘟嘟 <i>·</i> 胖一点，快乐多一点。</span><PhHeart weight="fill"/><span>Made for your little breaks.</span></footer>
    </template>
  </div>
</template>
