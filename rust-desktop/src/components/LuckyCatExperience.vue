<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhEye, PhPersonArmsSpread, PhHandPalm, PhEar, PhCoins, PhFish, PhCoffee, PhKeyboard, PhPackage, PhGift, PhMoon, PhSun, PhGearSix, PhMinus, PhGameController, PhPalette, PhX, PhArrowsClockwise, PhArrowUpLeft, PhArrowRight } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import { LUCKYCAT_ACTIONS, LUCKYCAT_LEVELS, advanceLuckyCat, beginLuckyCat, luckycatIdle, luckycatLevel, type LuckyCatAction } from '../luckycat/play'
import LuckyCatVisual from './LuckyCatVisual.vue'
import LuckyCatWardrobe from './LuckyCatWardrobe.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), panel = ref<'play' | 'wardrobe' | 'details' | null>(null), notice = ref(''), play = ref(luckycatIdle()), visible = ref(!document.hidden)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const icons = { coin: PhCoins, fish: PhFish, coffee: PhCoffee, keyboard: PhKeyboard, box: PhPackage, gift: PhGift, eye: PhEye, stretch: PhPersonArmsSpread, hand: PhHandPalm, ear: PhEar, moon: PhMoon }
const level = computed(() => luckycatLevel(props.percent)), active = computed(() => play.value.action !== 'idle')
const pose = computed(() => level.value)
const action = computed(() => LUCKYCAT_ACTIONS.find(item => item.id === play.value.action))
const speech = computed(() => action.value?.speech ?? LUCKYCAT_LEVELS[level.value].speech)
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '同步今日额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '正在连接' }[state.status]))
function focusWidget() { void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function act(value: LuckyCatAction) { if (!isDesktop && !widget.value?.contains(document.activeElement)) widget.value?.scrollIntoView({ behavior: state.settings.reducedMotion ? 'instant' : 'smooth', block: 'center' }); panel.value = null; notice.value = ''; play.value = beginLuckyCat(value, performance.now()); focusWidget() }
function cancel() { play.value = luckycatIdle(); focusWidget() }
function escape() { panel.value = null; notice.value = ''; cancel() }
function togglePanel(value: NonNullable<typeof panel.value>) { panel.value = panel.value === value ? null : value; notice.value = ''; if (!panel.value) focusWidget() }
function closePanel() { panel.value = null; focusWidget() }
async function perform(fn: () => Promise<unknown>, message: string) { try { await fn() } catch { notice.value = message } }
function demo(percent: number | null) { if (isDesktop) return; play.value = luckycatIdle(); if (percent === null) void api.logout(); else previewQuota(percent) }
function resetPlay() { play.value = luckycatIdle() }
function visibility() { visible.value = !document.hidden; if (!visible.value) resetPlay() }
watch(() => props.percent, (next, previous) => { if (visible.value && next !== null && previous !== null && previous <= 0 && next > 0 && !active.value && !panel.value) play.value = beginLuckyCat('fortune', performance.now()) })
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { if (visible.value) play.value = advanceLuckyCat(play.value, performance.now()) }, 100); document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', resetPlay) })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', resetPlay) })
</script>
<template>
  <div class="luckycat-experience" :class="{ 'luckycat-native': isDesktop }">
    <div class="luckycat-hero">
      <section ref="widget" tabindex="-1" class="luckycat-widget" :class="[{ 'has-panel': panel, 'has-action': active, 'has-notice': notice, 'is-moving': moving, 'is-paused': !visible }, `pose-${pose}`]" :style="{ '--luckycat-energy': LUCKYCAT_LEVELS[level].color }" aria-label="破产招财猫场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <div class="luckycat-character"><LuckyCatVisual :percent="percent" :action="play.action" :restart="play.startedAt" :skin="state.settings.luckycatSkin" :gentle="state.settings.reducedMotion" :paused="!visible || moving" ambient :ambient-allowed="!panel && !active && !moving"/></div>
        <button class="luckycat-body-hit scene-hit" :aria-label="play.action === 'box' ? '叫招财猫回来' : '点点招财猫，招招财'" @click="play.action === 'box' ? cancel() : act('fortune')"></button>
        <p class="luckycat-speech" aria-live="polite">{{ speech }}</p>
        <div class="luckycat-quota-wrap"><button class="luckycat-quota" :aria-expanded="panel === 'details'" :aria-label="`招财猫今日剩余额度 ${percent === null ? '未知' : Math.round(percent) + '%'}，${statusLabel}`" @click="togglePanel('details')"><span>今日余粮</span><i class="luckycat-meter"><i :style="{ width: `${percent === null ? 0 : Math.max(0, Math.min(100, percent))}%` }"></i></i><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong></button><span class="luckycat-amount">{{ usable && state.quota ? `¥${state.quota.remaining.toFixed(2)} / ¥${state.quota.limit.toFixed(2)}` : statusLabel }}<em v-if="state.status === 'stale'"> · 数据待更新</em></span></div>
        <header class="luckycat-header luckycat-chrome"><b>破产招财猫 <i>财</i></b><div><button aria-label="招财猫更多玩法" title="更多玩法" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="招财猫换衣服" title="换衣服" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhPalette/></button><button aria-label="招财猫设置" title="设置" @click="emit('settings')"><PhGearSix/></button><button aria-label="收起招财猫到托盘" title="收起到托盘" @click="perform(() => api.hide(), '收起失败，请重试。')"><PhMinus/></button></div></header>
        <nav class="luckycat-tools luckycat-chrome" aria-label="招财猫常用互动"><button v-for="item in LUCKYCAT_ACTIONS.slice(0, 3)" :key="item.id" :aria-label="'招财猫' + item.label" @click="act(item.id)"><component :is="icons[item.icon]"/><span>{{ item.label }}</span></button></nav>
        <footer class="luckycat-footer luckycat-chrome"><button @click="togglePanel('details')"><i></i>{{ statusLabel }}</button><button aria-label="刷新招财猫额度" :disabled="state.syncing || !state.quota" @click="perform(() => api.refresh(), '刷新失败，请稍后重试。')"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button><button v-if="!usable" :disabled="state.loginOpen" @click="emit('settings')">连接账户</button></footer>
        <div v-if="active" class="luckycat-hud" data-pet-gesture aria-live="polite"><span><b>{{ action?.label }}</b><small>{{ play.action === 'box' ? '歇一歇，随时叫我回来。' : action?.hint }}</small></span><button :aria-label="play.action === 'box' ? '招财猫回来' : '结束招财猫互动'" @click="cancel">{{ play.action === 'box' ? '回来' : '结束' }}</button></div>
        <section v-if="panel" class="luckycat-panel" data-pet-gesture role="dialog" :aria-label="panel === 'play' ? '招财猫玩法' : panel === 'wardrobe' ? '招财猫衣橱' : '招财猫额度详情'"><header><b>{{ panel === 'play' ? '今天陪猫玩什么？' : panel === 'wardrobe' ? '今天穿哪一套？' : '今日平台额度' }}</b><button aria-label="关闭招财猫面板" @click="closePanel"><PhX/></button></header><template v-if="panel === 'play'"><div class="luckycat-play-grid"><button v-for="item in LUCKYCAT_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.icon]"/><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span></button></div><p>互动只是陪伴，不改变真实 API 额度。</p></template><LuckyCatWardrobe v-else-if="panel === 'wardrobe'"/><template v-else><p>{{ statusLabel }} · {{ state.message }}</p><dl v-if="state.quota"><div><dt>{{ usable ? '今日剩余' : '上次记录剩余' }}</dt><dd>¥{{ state.quota.remaining.toFixed(2) }}</dd></div><div><dt>每日额度</dt><dd>¥{{ state.quota.limit.toFixed(2) }}</dd></div><div><dt>费用日期</dt><dd>{{ state.quota.day }}</dd></div><div><dt>费用更新时间</dt><dd>{{ state.quota.estimatedAt.replace('T', ' ').slice(0, 19) }}</dd></div></dl><p>以平台返回的费用日期与金额为准；招财、咖啡和红包都不会恢复额度。</p><button class="luckycat-link" @click="perform(() => api.openPortal(), '平台页面未能打开。')">前往平台核对 <PhArrowRight/></button></template></section>
        <div v-if="notice" class="luckycat-notice" data-pet-gesture role="status"><span>{{ notice }}</span><button aria-label="关闭招财猫提示" @click="notice = ''"><PhX/></button></div>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="luckycat-resize" :class="corner" :aria-label="`缩放招财猫 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="perform(() => api.settings({ windowWidth: state.settings.windowWidth + 10 }), '大小暂未保存。')" @keydown.down.prevent="perform(() => api.settings({ windowWidth: state.settings.windowWidth - 10 }), '大小暂未保存。')"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="luckycat-intro"><span class="luckycat-eyebrow">A LITTLE LUCK, A LOT OF COMPANY</span><div class="luckycat-intro-title"><h1>破产<br/>招财猫<span>。</span></h1><span class="luckycat-seal">财源喵进</span></div><p class="luckycat-tagline">额度有多少，猫猫说了算。</p><p class="luckycat-intro-copy">有余粮，就戴上墨镜享受。<br/>忙起来，就陪你认真敲键盘。<br/>哪怕小金库见底，也有猫猫一直在。</p><div class="luckycat-preview-actions"><button @click="act('fortune')"><PhCoins/>接一点小财运 <PhArrowRight/></button><button @click="perform(() => api.settings({ theme: night ? 'day' : 'night' }), '昼夜设置暂未保存。')"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '日光金灿灿' : '月下小金库' }}</button></div><small>桌角新朋友 / 09 <i>·</i> 浏览器预览 · 演示额度</small></aside>
    </div>
    <template v-if="!isDesktop">
      <section class="luckycat-preview-section"><header><div><span>01 / 猫猫的小金库</span><h2>从躺平到抱币，猫生全看余额。</h2></div><button class="luckycat-link" :aria-pressed="percent === null" @click="demo(null)">未知额度 · —</button></header><div class="luckycat-states"><button v-for="value in [100, 50, 20, 15]" :key="value" :aria-label="`预览招财猫 ${value}%`" :aria-pressed="percent === value" @click="demo(value)"><div><LuckyCatVisual :percent="value" :skin="state.settings.luckycatSkin" gentle paused/></div><span><i :style="{ background: LUCKYCAT_LEVELS[luckycatLevel(value)].color }"></i><strong>{{ value }}<small>%</small></strong></span><b>{{ LUCKYCAT_LEVELS[luckycatLevel(value)].label }}</b></button></div></section>
      <section class="luckycat-preview-section"><header><div><span>02 / 今日份陪伴</span><h2>小小互动，慢慢亲近。</h2></div><small>也会自动发生，安静陪你。</small></header><div class="luckycat-interactions"><button v-for="item in LUCKYCAT_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.icon]"/><b>{{ item.label }}</b><small>{{ item.hint }}</small><PhArrowRight/></button></div></section>
      <section class="luckycat-preview-section"><header><div><span>03 / 猫猫的衣橱</span><h2>换身衣服，换个可爱身份。</h2></div><small>服装独立保存</small></header><LuckyCatWardrobe/></section>
      <footer class="luckycat-preview-footer"><span>破产招财猫 <i>·</i> 额度会变，猫猫一直在。</span><span class="luckycat-seal">有猫</span><span>Stay lucky. Stay together.</span></footer>
    </template>
  </div>
</template>
