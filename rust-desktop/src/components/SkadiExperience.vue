<script setup lang="ts">
import PetNotices from './PetNotices.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhHandPalm, PhMusicNotes, PhSword, PhCat, PhBriefcase, PhMoon, PhSun, PhGearSix, PhMinus, PhGameController, PhPalette, PhX, PhArrowsClockwise, PhArrowUpLeft, PhArrowRight, PhPersonSimpleWalk, PhArmchair, PhCoffee, PhSparkle, PhFish, PhCookie, PhWind, PhEye } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import { SKADI_ACTIONS, SKADI_LEVELS, advanceSkadi, beginSkadi, skadiIdle, skadiLevel, type SkadiAction } from '../skadi/play'
import SkadiVisual from './SkadiVisual.vue'
import SkadiCat from './SkadiCat.vue'
import SkadiArmory from './SkadiArmory.vue'
import { skadiSelectedSkin, SKADI_FORMS } from '../shared/types'
import { skadiFishingPhase } from '../skadi/motion'
import SkadiWardrobe from './SkadiWardrobe.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), panel = ref<'play' | 'wardrobe' | 'details' | 'armory' | null>(null), notice = ref(''), play = ref(skadiIdle()), visible = ref(!document.hidden)
const noticeOpen = ref(false)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const icons = { hand: PhHandPalm, music: PhMusicNotes, sword: PhSword, cat: PhCat, work: PhBriefcase, moon: PhMoon, walk: PhPersonSimpleWalk, sit: PhArmchair, tea: PhCoffee, sparkle: PhSparkle, fish: PhFish, food: PhCookie, wind: PhWind, look: PhEye }
const selectedSkin = computed(() => skadiSelectedSkin(state.settings))
const tickNow=ref(0), caught=ref(false), fishNote=ref('')
const fishing=computed(()=>caught.value?'caught':skadiFishingPhase(tickNow.value-play.value.startedAt))
const level = computed(() => skadiLevel(props.percent)), active = computed(() => play.value.action !== 'idle')
const pose = computed(() => play.value.action === 'sleep' ? 'sleep' : level.value)
const action = computed(() => SKADI_ACTIONS.find(item => item.id === play.value.action))
const speech = computed(() => play.value.action==='fish' ? (caught.value?'钓到一条银色的小鱼！':(fishing.value==='bite'?'鱼漂动了，现在提竿！':fishNote.value||action.value?.speech)) : action.value?.speech ?? SKADI_LEVELS[level.value].speech)
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '同步今日额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '正在连接' }[state.status]))
function focusWidget() { void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function act(value: SkadiAction) { panel.value = null; notice.value = ''; caught.value=false;fishNote.value='';tickNow.value=performance.now();play.value = beginSkadi(value,tickNow.value); focusWidget() }
function cancel() { resetPlay(); focusWidget() }
function reel(){if(play.value.action!=='fish'||caught.value)return;if(fishing.value==='bite'){caught.value=true;fishNote.value='';play.value={...play.value,startedAt:performance.now()-6000}}else fishNote.value='再等等，鱼漂还没有动。'}
function escape() { panel.value = null; notice.value = ''; cancel() }
function togglePanel(value: NonNullable<typeof panel.value>) { panel.value = panel.value === value ? null : value; notice.value = ''; if (!panel.value) focusWidget() }
function closePanel() { panel.value = null; focusWidget() }
async function perform(fn: () => Promise<unknown>, message: string) { try { await fn() } catch { notice.value = message } }
function demo(percent: number | null) { if (isDesktop) return; play.value = skadiIdle(); if (percent === null) void api.logout(); else previewQuota(percent) }
function resetPlay() { play.value = skadiIdle();caught.value=false;fishNote.value='' }
function visibility() { visible.value = !document.hidden; if (!visible.value) resetPlay() }
// A new shared message/quota snapshot is not a wardrobe change.
watch([() => state.settings.skadiSkin, () => state.settings.skadiAdultSkin, () => state.settings.skadiForm, () => state.settings.skadiWeapon], resetPlay)
function loseFocus() { if (!noticeOpen.value) resetPlay() }
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { if (visible.value) {tickNow.value=performance.now();play.value = advanceSkadi(play.value,tickNow.value)} }, 100); document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', loseFocus) })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', loseFocus) })
</script>
<template>
  <div class="skadi-experience" :class="{ 'skadi-native': isDesktop }">
    <div class="skadi-hero">
      <section ref="widget" tabindex="-1" class="skadi-widget" :class="[{ 'has-panel': panel, 'has-action': active, 'has-notice': notice, 'is-moving': moving, 'is-paused': !visible }, `pose-${pose}`,`form-${state.settings.skadiForm}`,`action-${play.action}`]" :style="{ '--skadi-energy': SKADI_LEVELS[level].color, '--skadi-glow': SKADI_LEVELS[level].glow }" aria-label="斯卡蒂月汐场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <PetNotices :blocked="!!panel || active || moving || !!notice" :message-blocked="!!panel || moving || !!notice" :message-deferred="active" @open-change="noticeOpen = $event"/>
        <div class="skadi-character"><SkadiVisual :key="play.startedAt" :percent="percent" :action="play.action" :skin="selectedSkin" :form="state.settings.skadiForm" :weapon="state.settings.skadiWeapon" :gentle="state.settings.reducedMotion" :paused="!visible || moving" :ambient="!panel" :fishing="fishing"/></div>
        <div class="skadi-moon" aria-hidden="true"><i></i><span>✦</span></div>
        <div class="skadi-tide" aria-hidden="true"></div>
        <button v-if="play.action !== 'sleep' && play.action !== 'blade'" class="skadi-head-hit scene-hit" aria-label="轻轻摸摸月汐的头" @click="act('pet')"></button>
        <button class="skadi-body-hit scene-hit" :aria-label="play.action === 'sleep' ? '唤醒月汐' : '让月汐陪你工作'" @click="play.action === 'sleep' ? cancel() : act('work')"></button>
        <div class="skadi-companion"><SkadiCat :active="play.action === 'cat'" :asleep="play.action === 'sleep'" :gentle="state.settings.reducedMotion" :paused="!visible || moving"/></div>
        <button class="skadi-cat-hit scene-hit" aria-label="逗逗小黑猫夜影" @click="act('cat')"></button>
        <p class="skadi-speech" aria-live="polite">{{ speech }}</p>
        <div class="skadi-quota-wrap"><button class="skadi-quota" :aria-expanded="panel === 'details'" :aria-label="`月汐今日剩余额度 ${percent === null ? '未知' : Math.round(percent) + '%'}，${statusLabel}`" @click="togglePanel('details')"><span>今日余光</span><i class="skadi-meter"><i :style="{ width: `${percent === null ? 0 : Math.max(0, Math.min(100, percent))}%` }"></i></i><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong></button><span class="skadi-amount">{{ usable && state.quota ? `¥${state.quota.remaining.toFixed(2)} / ¥${state.quota.limit.toFixed(2)}` : statusLabel }}<em v-if="state.status === 'stale'"> · 数据待更新</em></span></div>
        <header class="skadi-header skadi-chrome"><b>月汐 <i>YUE XI</i></b><div><button aria-label="月汐更多玩法" title="更多玩法" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="月汐换装" title="换装" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhPalette/></button><button aria-label="月汐武器库" title="武器库" :aria-expanded="panel==='armory'" @click="togglePanel('armory')"><PhSword/></button><button aria-label="月汐设置" title="设置" @click="emit('settings')"><PhGearSix/></button><button aria-label="收起月汐到托盘" title="收起到托盘" @click="perform(() => api.hide(), '收起失败，请重试。')"><PhMinus/></button></div></header>
        <nav class="skadi-tools skadi-chrome" aria-label="月汐常用互动"><button v-for="item in SKADI_ACTIONS.slice(0, 3)" :key="item.id" :aria-label="'月汐' + item.label" @click="act(item.id)"><component :is="icons[item.icon]"/><span>{{ item.label }}</span></button></nav>
        <footer class="skadi-footer skadi-chrome"><button @click="togglePanel('details')"><i></i>{{ statusLabel }}</button><button aria-label="刷新月汐额度" :disabled="state.syncing || !state.quota" @click="perform(() => api.refresh(), '刷新失败，请稍后重试。')"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button><button v-if="!usable" :disabled="state.loginOpen" @click="emit('settings')">连接账户</button></footer>
        <div v-if="active" class="skadi-hud" data-pet-gesture aria-live="polite"><span><b>{{ action?.label }}</b><small>{{ play.action === 'fish' ? (caught ? '小鱼上钩了，稍后自动收竿。' : fishing==='bite' ? '鱼漂动了！点击提竿。' : '等待鱼漂发光…') : play.action === 'sleep' ? '晚安。轻点她，或者叫她醒来。' : action?.hint }}</small></span><button v-if="play.action==='fish'&&!caught" @click="reel" :class="{'fish-ready':fishing==='bite'}">提竿</button><button :aria-label="play.action === 'sleep' ? '唤醒月汐' : '结束月汐互动'" @click="cancel">{{ play.action === 'sleep' ? '唤醒' : play.action === 'work' ? '休息一下' : '结束' }}</button></div>
        <section v-if="panel" class="skadi-panel" data-pet-gesture role="dialog" :aria-label="panel === 'play' ? '月汐玩法' : panel === 'wardrobe' ? '月汐衣橱' : panel === 'armory' ? '月汐武器库' : '月汐额度详情'"><header><b>{{ panel === 'play' ? '想和月汐做些什么？' : panel === 'wardrobe' ? '形态与衣装' : panel === 'armory' ? '月下兵装' : '今日平台额度' }}</b><button aria-label="关闭月汐面板" @click="closePanel"><PhX/></button></header><template v-if="panel === 'play'"><div class="skadi-play-grid"><button v-for="item in SKADI_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.icon]"/><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span></button></div><p>互动只是陪伴，不改变真实 API 额度。</p></template><SkadiWardrobe v-else-if="panel === 'wardrobe'"/><SkadiArmory v-else-if="panel === 'armory'"/><template v-else><p>{{ statusLabel }} · {{ state.message }}</p><dl v-if="state.quota"><div><dt>{{ usable ? '今日剩余' : '上次记录剩余' }}</dt><dd>¥{{ state.quota.remaining.toFixed(2) }}</dd></div><div><dt>每日额度</dt><dd>¥{{ state.quota.limit.toFixed(2) }}</dd></div><div><dt>费用日期</dt><dd>{{ state.quota.day }}</dd></div><div><dt>费用更新时间</dt><dd>{{ state.quota.estimatedAt.replace('T', ' ').slice(0, 19) }}</dd></div></dl><p>以平台返回的费用日期与金额为准；摸头、演舞和休息都不会恢复额度。</p><button class="skadi-link" @click="perform(() => api.openPortal(), '平台页面未能打开。')">前往平台核对 <PhArrowRight/></button></template></section>
        <div v-if="notice" class="skadi-notice" data-pet-gesture role="status"><span>{{ notice }}</span><button aria-label="关闭月汐提示" @click="notice = ''"><PhX/></button></div>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="skadi-resize" :class="corner" :aria-label="`缩放月汐 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="perform(() => api.settings({ windowWidth: state.settings.windowWidth + 10 }), '大小暂未保存。')" @keydown.down.prevent="perform(() => api.settings({ windowWidth: state.settings.windowWidth - 10 }), '大小暂未保存。')"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="skadi-intro">
        <span class="skadi-eyebrow"><i></i> MOONLIT OCEAN · DESKTOP COMPANION</span>
        <p class="skadi-subtitle">斯卡蒂 / 月下的陪伴者</p>
        <h1>月 汐<span>Y U E &nbsp; X I</span></h1>
        <div class="skadi-form-picker skadi-intro-form" aria-label="预览月汐形态"><button v-for="item in SKADI_FORMS" :key="item.id" :aria-pressed="state.settings.skadiForm===item.id" @click="perform(() => api.settings({skadiForm:item.id}), '形态暂未保存。')"><span>{{item.label}}</span><small>{{item.hint}}</small></button></div>
        <p class="skadi-poem">月色为契，<br/>而我，只为陪伴。</p>
        <p class="skadi-intro-copy">无论工作多忙，世界多喧嚣。<br/>总有一缕月光，静静落在你的桌角。</p>
        <div class="skadi-preview-actions"><button @click="act('pet')"><PhHandPalm/>轻轻摸摸她 <PhArrowRight/></button><button @click="perform(() => api.settings({ theme: night ? 'day' : 'night' }), '昼夜设置暂未保存。')"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '晨光微明' : '月色降临' }}</button></div>
        <small>银发 / 红瞳 / 一只名叫夜影的小黑猫</small>
      </aside>
    </div>
    <template v-if="!isDesktop">
      <section class="skadi-preview-section"><header><div><span>01 / THE TIDES OF TODAY</span><h2>潮起潮落，都陪在你身边。</h2></div><button class="skadi-link" :aria-pressed="percent === null" @click="demo(null)">未知额度 · —</button></header><div class="skadi-states"><button v-for="value in [100, 50, 20, 15]" :key="value" :aria-label="`预览月汐 ${value}%`" :aria-pressed="percent === value" @click="demo(value)"><div><SkadiVisual :percent="value" :skin="selectedSkin" :form="state.settings.skadiForm" :weapon="state.settings.skadiWeapon" gentle paused/></div><span><i :style="{ background: SKADI_LEVELS[skadiLevel(value)].color }"></i><strong>{{ value }}<small>%</small></strong></span><b>{{ SKADI_LEVELS[skadiLevel(value)].label }}</b></button></div></section>
      <section class="skadi-preview-section"><header><div><span>02 / LITTLE MOMENTS</span><h2>一些只属于你们的小事。</h2></div><small>轻轻一点，让她回应你。</small></header><div class="skadi-interactions"><button v-for="item in SKADI_ACTIONS" :key="item.id" @click="act(item.id)"><component :is="icons[item.icon]"/><b>{{ item.label }}</b><small>{{ item.hint }}</small><PhArrowRight/></button></div></section>
      <section class="skadi-preview-section"><header><div><span>03 / HER WARDROBE</span><h2>月光，落在不同的衣角。</h2></div><small>装扮独立保存</small></header><SkadiWardrobe/></section>
      <section class="skadi-preview-section"><header><div><span>04 / MOONLIT ARSENAL</span><h2>静守身旁，亦能为你锋芒。</h2></div><small>待机可见 · 六件独立武器</small></header><SkadiArmory/></section>
      <footer class="skadi-preview-footer"><span>斯卡蒂 · 月汐 <i>·</i> 把浪漫的夜色，装进你的桌面。</span><span class="skadi-footer-star">✦</span><span>Same moon. Always with you.</span></footer>
    </template>
  </div>
</template>
