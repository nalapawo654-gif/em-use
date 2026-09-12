<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhDeviceMobile, PhHeart, PhCoffee, PhCookie, PhHandPalm, PhLaptop, PhSparkle, PhMoon, PhSun, PhGearSix, PhMinus, PhGameController, PhTShirt, PhX, PhArrowsClockwise, PhArrowUpLeft, PhArrowRight } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import { DINOSAUR_ACTIONS, DINOSAUR_LEVELS, advanceDinosaur, beginDinosaur, dinosaurIdle, dinosaurLevel, dinosaurFrame, type DinosaurAction } from '../dinosaur/play'
import { dinosaurFlight, chooseDinosaurMotion, dinosaurMotionDelay, DINOSAUR_MOTIONS, type DinosaurMotion } from '../dinosaur/ambient'
import DinosaurVisual from './DinosaurVisual.vue'
import DinosaurWardrobe from './DinosaurWardrobe.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), panel = ref<'play' | 'wardrobe' | 'details' | null>(null), notice = ref(''), play = ref(dinosaurIdle()), visible = ref(!document.hidden)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const icons = { phone: PhDeviceMobile, heart: PhHeart, tea: PhCoffee, cookie: PhCookie, hand: PhHandPalm, work: PhLaptop, sparkle: PhSparkle, moon: PhMoon }
const quick = DINOSAUR_ACTIONS.filter(item => ['tea', 'cookie', 'work', 'rest'].includes(item.id))
const level = computed(() => dinosaurLevel(props.percent)), active = computed(() => play.value.action !== 'idle')
const action = computed(() => DINOSAUR_ACTIONS.find(item => item.id === play.value.action))
const focused = ref(true), systemGentle = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
let previousMotion: DinosaurMotion | null = null, idleTimer: ReturnType<typeof setTimeout> | undefined
let firstIdle = true
const idleEnabled = computed(() => visible.value && focused.value && !panel.value && !active.value && !moving.value && !state.settings.reducedMotion && !systemGentle.value)
function stopIdle() { clearTimeout(idleTimer); idleTimer = undefined }
function scheduleIdle() {
  stopIdle(); if (!idleEnabled.value) return
  idleTimer = setTimeout(() => {
    if (!idleEnabled.value) return
    const motion = chooseDinosaurMotion(level.value, previousMotion)
    if (motion) { previousMotion = motion; play.value = beginDinosaur(motion, performance.now()) }
    firstIdle = false
  }, dinosaurMotionDelay(Math.random, firstIdle))
}
watch([idleEnabled, level], scheduleIdle)
watch([panel, moving], () => { if ((panel.value || moving.value) && play.value.action in DINOSAUR_MOTIONS) play.value = dinosaurIdle() })
function regainFocus() { focused.value = true }
function loseFocus() { focused.value = false; clearShortAction() }
const media = window.matchMedia('(prefers-reduced-motion: reduce)')
function motionPreference() { systemGentle.value = media.matches }
const speech = computed(() => action.value?.speech ?? DINOSAUR_LEVELS[level.value].speech)
const lying = computed(() => [2, 3, 4, 7].includes(dinosaurFrame(props.percent, play.value.action)))
const flightClock = ref(0)
const flightHit = computed(() => {
  if (play.value.action !== 'fly' || state.settings.reducedMotion || systemGentle.value) return undefined
  const f = dinosaurFlight(Math.max(0, (flightClock.value - play.value.startedAt) / DINOSAUR_MOTIONS.fly.duration))
  return { transform: `translate(calc(${f.x / 512} * var(--dino-art-width) * 1cqw), calc(${f.y / 512} * var(--dino-art-height) * 1cqw)) rotate(${f.angle}rad) scale(${f.scale})`, transformOrigin: '50% 100%' }
})
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
function act(value: DinosaurAction) { panel.value = null; notice.value = ''; play.value = beginDinosaur(value, performance.now()); focusWidget() }
function cancel() { play.value = dinosaurIdle(); focusWidget() }
function escape() { panel.value = null; notice.value = ''; cancel() }
function pet() { if (play.value.action === 'rest') cancel(); else act('pet') }
function togglePanel(value: NonNullable<typeof panel.value>) { panel.value = panel.value === value ? null : value; notice.value = ''; if (!panel.value) focusWidget() }
function closePanel() { panel.value = null; focusWidget() }
async function perform(fn: () => Promise<unknown>, error: string) { try { await fn() } catch { notice.value = error } }
function demo(percent: number | null) { if (isDesktop) return; play.value = dinosaurIdle(); if (percent === null) void api.logout(); else previewQuota(percent) }
function visibility() { visible.value = !document.hidden; if (!visible.value) clearShortAction() }
function clearShortAction() { if (action.value?.duration != null) play.value = dinosaurIdle() }
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { if (visible.value) { flightClock.value = performance.now(); play.value = advanceDinosaur(play.value, flightClock.value) } }, 33); document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', loseFocus); window.addEventListener('focus', regainFocus); media.addEventListener('change', motionPreference); scheduleIdle() })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', loseFocus); window.removeEventListener('focus', regainFocus); media.removeEventListener('change', motionPreference); stopIdle() })
</script>
<template>
  <div class="dinosaur-experience" :class="{ 'dinosaur-native': isDesktop }">
    <div class="dinosaur-hero">
      <section ref="widget" tabindex="-1" class="dinosaur-widget" :class="{ 'has-panel': panel, 'has-action': active, 'has-notice': notice, 'is-moving': moving, 'is-paused': !visible }" :style="{ '--dino-energy': DINOSAUR_LEVELS[level].color }" aria-label="小恐龙场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <div class="dinosaur-character"><DinosaurVisual :percent="percent" :action="play.action" :skin="state.settings.dinosaurSkin" :gentle="state.settings.reducedMotion" :paused="!visible || !focused || moving" :started-at="play.startedAt"/></div>
        <button class="dinosaur-body-hit scene-hit" :class="{ lying: lying && !(play.action in DINOSAUR_MOTIONS), 'in-flight': play.action === 'fly' }" :style="flightHit" :aria-label="play.action === 'rest' ? '叫小恐龙起床' : '摸摸小恐龙的头'" @click="pet"></button>
        <p class="dinosaur-speech" aria-live="polite">{{ speech }}<PhHeart v-if="play.action === 'pet' || play.action === 'pillow'" weight="fill"/></p>
        <span v-if="play.action === 'rest'" class="dinosaur-zzz" aria-hidden="true">z Z</span>
        <div class="dinosaur-quota-wrap"><button class="dinosaur-quota" :aria-expanded="panel === 'details'" :aria-label="`小恐龙今日剩余额度 ${percent === null ? '未知' : Math.round(percent) + '%'}，${statusLabel}`" @click="togglePanel('details')"><span>今日剩余</span><i class="dinosaur-meter"><i :style="{ width: `${percent === null ? 0 : Math.max(0, Math.min(100, percent))}%` }"></i></i><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong></button><span class="dinosaur-amount">{{ usable && state.quota ? `¥${state.quota.remaining.toFixed(2)} / ¥${state.quota.limit.toFixed(2)}` : statusLabel }}<em v-if="state.status === 'stale'"> · 数据待更新</em></span></div>
        <header class="dinosaur-header dinosaur-chrome"><b><PhHeart weight="duotone"/>小恐龙</b><div><button aria-label="小恐龙更多玩法" title="更多玩法" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="小恐龙换装" title="换装" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhTShirt/></button><button aria-label="小恐龙设置" title="设置" @click="emit('settings')"><PhGearSix/></button><button aria-label="收起小恐龙到托盘" title="收起到托盘" @click="perform(() => api.hide(), '收起失败，请重试。')"><PhMinus/></button></div></header>
        <nav class="dinosaur-tools dinosaur-chrome" aria-label="小恐龙常用互动"><button v-for="item in quick" :key="item.id" :aria-label="'小恐龙' + item.label" @click="act(item.id)"><component :is="icons[item.icon]" weight="duotone"/><span>{{ item.label }}</span></button></nav>
        <footer class="dinosaur-footer dinosaur-chrome"><button @click="togglePanel('details')"><i></i>{{ statusLabel }}</button><button aria-label="刷新小恐龙额度" :disabled="state.syncing || !state.quota" @click="perform(() => api.refresh(), '刷新失败，请稍后重试。')"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button><button v-if="!usable" :disabled="state.loginOpen" @click="emit('settings')">连接账户</button></footer>
        <div v-if="active" class="dinosaur-hud" data-pet-gesture aria-live="polite"><span><b>{{ action?.label }}</b><small>{{ play.action === 'work' ? '你忙你的，我在这里。' : play.action === 'rest' ? '好好休息，随时叫我。' : '一点小快乐，正在发生。' }}</small></span><button :aria-label="play.action === 'rest' ? '小恐龙起床' : '结束小恐龙互动'" @click="cancel">{{ play.action === 'rest' ? '起床' : play.action === 'work' ? '结束陪伴' : '结束' }}</button></div>
        <section v-if="panel" class="dinosaur-panel" data-pet-gesture role="dialog" :aria-label="panel === 'play' ? '小恐龙玩法' : panel === 'wardrobe' ? '小恐龙衣橱' : '小恐龙额度详情'"><header><b>{{ panel === 'play' ? '小恐龙的摸鱼计划' : panel === 'wardrobe' ? '今天穿哪种心情？' : '今日平台额度' }}</b><button aria-label="关闭小恐龙面板" @click="closePanel"><PhX/></button></header><template v-if="panel === 'play'"><div class="dinosaur-play-grid"><button v-for="item in DINOSAUR_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.icon]" weight="duotone"/><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span></button></div><p>互动只是陪伴，不改变真实 API 额度。</p></template><DinosaurWardrobe v-else-if="panel === 'wardrobe'"/><template v-else><p>{{ statusLabel }} · {{ state.message }}</p><dl v-if="state.quota"><div><dt>{{ usable ? '今日剩余' : '上次记录剩余' }}</dt><dd>¥{{ state.quota.remaining.toFixed(2) }}</dd></div><div><dt>每日额度</dt><dd>¥{{ state.quota.limit.toFixed(2) }}</dd></div><div><dt>费用日期</dt><dd>{{ state.quota.day }}</dd></div><div><dt>费用更新时间</dt><dd>{{ state.quota.estimatedAt.replace('T', ' ').slice(0, 19) }}</dd></div></dl><p>以平台返回的费用日期与金额为准；摸摸、零食和休息不会恢复额度。</p><button class="dinosaur-link" :disabled="state.syncing || !state.quota" @click="perform(() => api.refresh(), '刷新失败，请稍后重试。')"><PhArrowsClockwise/>刷新额度</button><button class="dinosaur-link" @click="perform(() => api.openPortal(), '平台页面未能打开。')">前往平台核对 <PhArrowRight/></button></template></section>
        <div v-if="notice" class="dinosaur-notice" data-pet-gesture role="status"><span>{{ notice }}</span><button aria-label="关闭小恐龙提示" @click="notice = ''"><PhX/></button></div>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="dinosaur-resize" :class="corner" :aria-label="`缩放小恐龙 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="perform(() => api.settings({ windowWidth: state.settings.windowWidth + 10 }), '大小暂未保存。')" @keydown.down.prevent="perform(() => api.settings({ windowWidth: state.settings.windowWidth - 10 }), '大小暂未保存。')"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="dinosaur-intro"><span class="dinosaur-eyebrow">TINY DINO · BIG DAYDREAMS</span><span class="dinosaur-edition">摸鱼搭子 / LITTLE DINOSAUR</span><h1>虽然是恐龙，<br/>也要<span>上班呀。</span></h1><p>小小的身体，装着大大的摸鱼梦想。<br/>陪你认真开工，也陪你理直气壮地歇一会儿。</p><div class="dinosaur-signature">小小的我，也在努力生活呀。<PhHeart weight="fill"/></div><div class="dinosaur-preview-actions"><button @click="act('pet')"><PhHandPalm/>摸摸它的小脑袋 <PhArrowRight/></button><button @click="perform(() => api.settings({ theme: night ? 'day' : 'night' }), '昼夜设置暂未保存。')"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '晴朗白天' : '夜晚陪伴' }}</button></div><small>浏览器外观预览 · 演示额度</small></aside>
    </div>
    <template v-if="!isDesktop">
      <section class="dinosaur-preview-section"><header><div><span>01 / 小恐龙的工作电量</span><h2>从「冲呀」，到「先下线了」。</h2></div><button class="dinosaur-link" :aria-pressed="percent === null" @click="demo(null)">未知额度 · —</button></header><div class="dinosaur-states"><button v-for="value in [100, 70, 50, 20, 15]" :key="value" :aria-label="`预览小恐龙 ${value}% · ${DINOSAUR_LEVELS[dinosaurLevel(value)].label}`" :aria-pressed="percent === value" @click="demo(value)"><div><DinosaurVisual :percent="value" :skin="state.settings.dinosaurSkin" gentle/></div><span><i :style="{ background: DINOSAUR_LEVELS[dinosaurLevel(value)].color }"></i><strong>{{ value }}<small>%</small></strong></span><b>{{ DINOSAUR_LEVELS[dinosaurLevel(value)].label }}</b></button></div></section>
      <section class="dinosaur-preview-section"><header><div><span>02 / 快乐，其实很具体</span><h2>给平平无奇的一天，加点料。</h2></div><small>点一下，去桌角陪它玩。</small></header><div class="dinosaur-interactions"><button v-for="item in DINOSAUR_ACTIONS" :key="item.id" @click="act(item.id)"><div><DinosaurVisual :frame="item.frame" :action="item.id in DINOSAUR_MOTIONS ? item.id : 'idle'" :skin="state.settings.dinosaurSkin" gentle/></div><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span><PhArrowRight/></button></div></section>
      <section class="dinosaur-preview-section dinosaur-preview-wardrobe"><header><div><span>03 / 给小恐龙换个心情</span><h2>今天，也要可可爱爱。</h2></div><small>四种配色 · 独立保存</small></header><DinosaurWardrobe/></section>
      <footer class="dinosaur-preview-footer"><span>小恐龙 <i>·</i> 先摸鱼，再说。</span><PhHeart weight="fill"/><span>Made for your little breaks.</span></footer>
    </template>
  </div>
</template>
