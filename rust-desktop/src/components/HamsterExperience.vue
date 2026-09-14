<script setup lang="ts">
import PetNotices from './PetNotices.vue'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { PhLightning, PhGearSix, PhMinus, PhGameController, PhX, PhInfo, PhArrowsClockwise, PhMoon, PhSun, PhHandHeart, PhGrains, PhCircleDashed, PhArrowUpLeft, PhHeart, PhArrowRight, PhTShirt, PhBell, PhCoffee, PhCat, PhPaintBrush } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import type { Settings } from '../shared/types'
import { advanceHamster, beginHamster, hamsterIdle, hamsterLevel, HAMSTER_LEVELS, tapHamsterWheel, WHEEL_TARGET, type HamsterAction } from '../hamster/play'
import { HAMSTER_LAYOUT } from '../hamster/layout'
import HamsterCat from './HamsterCat.vue'
import HamsterProp from './HamsterProp.vue'
import HamsterSkinPicker from './HamsterSkinPicker.vue'
import HamsterVisual from './HamsterVisual.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), panel = ref<'play' | 'details' | 'wardrobe' | null>(null), notice = ref('')
const play = ref(hamsterIdle()), visible = ref(!document.hidden)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const level = computed(() => hamsterLevel(props.percent)), active = computed(() => play.value.action !== 'idle')
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '同步今日额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '等待登录' }[state.status]))
const speech = computed(() => ({ idle: HAMSTER_LEVELS[level.value].speech, feed: '咔嚓咔嚓，快乐就是一颗瓜子。', wheel: play.value.completedAt !== null ? '六圈完成！和你一起真开心。' : '再转一圈，陪鼠鼠跑起来！', sleep: '嘘…鼠鼠先睡一小会儿。', pet: '收到你的小心意啦！', groom:'梳梳毛，今天也要蓬蓬松松。', bell:'叮铃！鼠鼠精神了一点。', tease:'监工也忍不住来玩啦。', coffee:'闻到香气，打起精神！','cat-yawn':'监工也会犯困，哈——欠。','cat-nap':'嘘，小监工正趴在纸箱上补觉。','cat-snack':'鼠鼠忙着跑，它偷偷嗑上了。' }[play.value.action]))
const interactions = [
 {action:'feed' as const,label:'喂瓜子',icon:PhGrains,prop:8,hint:'快乐就是咔嚓一口'},
 {action:'groom' as const,label:'梳梳毛',icon:PhPaintBrush,prop:4,hint:'顺顺毛，放轻松'},
 {action:'bell' as const,label:'敲铃铛',icon:PhBell,prop:5,hint:'叮铃，开工打气'},
 {action:'tease' as const,label:'逗逗猫',icon:PhCat,prop:6,hint:'监工也来玩一会儿'},
 {action:'coffee' as const,label:'递咖啡',icon:PhCoffee,prop:7,hint:'闻到今天的好心情'},
 {action:'sleep' as const,label:'盖被子',icon:PhMoon,prop:9,hint:'安心睡，随时能叫醒'},
]
const actionLabel = computed(()=>({idle:'',feed:'咔嚓咔嚓，瓜子真香',groom:'梳梳毛，蓬松又舒服',bell:'叮铃铃，给鼠鼠打气',tease:'监工猫也来玩啦',coffee:'喝一口，精神一下',sleep:'小被子盖好，安心睡吧',pet:'鼠鼠收到你的喜欢',wheel:'陪鼠鼠转一圈','cat-yawn':'监工猫打了个哈欠','cat-nap':'监工猫睡着了，Zzz…','cat-snack':'抓到猫猫偷吃瓜子！'}[play.value.action]))
function place(name:keyof typeof HAMSTER_LAYOUT){const r=HAMSTER_LAYOUT[name];return {left:r.x+'%',top:r.y+'%',width:r.width+'%',height:r.height+'%'}}
const actionProp = computed(()=>interactions.find(i=>i.action===play.value.action)?.prop)
const states = [{ percent: 100, label: '活力满满', hint: '开工！能量满格' }, { percent: 50, label: '努力发电', hint: '鼠鼠还在坚持' }, { percent: 20, label: '鼠鼠累了', hint: '慢一点，歇口气' }, { percent: 15, label: '暂停营业', hint: '今日份工作结束' }]
let timer: ReturnType<typeof setInterval> | undefined
function focusWidget() { void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function act(action: HamsterAction) { panel.value = null; notice.value = ''; play.value = beginHamster(action, performance.now()); focusWidget() }
let catTurn=0
function catAction(){act((['cat-yawn','cat-nap','cat-snack'] as const)[catTurn++%3])}
function cancel() { play.value = hamsterIdle(); focusWidget() }
function escape() { panel.value = null; notice.value = ''; cancel() }
function pet() { if (play.value.action === 'sleep') cancel(); else act('pet') }
function turnWheel() { if (play.value.action !== 'wheel') act('wheel'); play.value = tapHamsterWheel(play.value, performance.now()) }
function togglePanel(value: NonNullable<typeof panel.value>) { panel.value = panel.value === value ? null : value; notice.value = ''; if (!panel.value) focusWidget() }
function closePanel() { panel.value = null; focusWidget() }
function demo(percent: number) { if (!isDesktop) { previewQuota(percent); play.value = hamsterIdle() } }
async function setting(patch: Partial<Settings>) { try { await api.settings(patch) } catch { notice.value = '设置暂未保存，请重试' } }
async function login() { try { await api.login(); if (!isDesktop) notice.value = '请在桌面客户端完成官方登录' } catch { notice.value = '登录窗口未能打开，请重试' } }
async function refresh() { try { await api.refresh() } catch { notice.value = '刷新失败，请稍后重试' } }
async function hide() { try { await api.hide(); if (!isDesktop) notice.value = '桌面版可收起到系统托盘' } catch { notice.value = '收起失败，请重试' } }
function visibility() { visible.value = !document.hidden; if (!visible.value && play.value.action !== 'sleep') play.value = hamsterIdle() }
onMounted(() => { timer = setInterval(() => { if (visible.value) play.value = advanceHamster(play.value, performance.now()) }, 80); document.addEventListener('visibilitychange', visibility) })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility) })
</script>
<template>
  <div class="hamster-experience" :class="{ 'hamster-native': isDesktop }">
    <div class="hamster-hero">
      <section ref="widget" tabindex="-1" class="hamster-widget" :class="{ 'has-panel': panel, 'has-action': active, 'has-notice': notice, 'is-moving': moving }" aria-label="仓鼠动力机房场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <PetNotices :blocked="!!panel || active || moving || !!notice"/>
        <HamsterVisual :style="place('visual')" :skin="state.settings.hamsterSkin" :level="level" :action="play.action" :reduced-motion="state.settings.reducedMotion" :active="visible"/>
        <button class="hamster-scene-prop hamster-cat scene-hit" :style="place('cat')" aria-label="看看监工猫的小动作" title="点击切换：哈欠、睡觉、偷吃" @click="catAction"><HamsterCat :action="play.action" :since="play.since" :night="night" :reduced-motion="state.settings.reducedMotion" :active="visible"/></button>
        <button class="hamster-scene-prop hamster-cup scene-hit" :style="place('cup')" aria-label="从瓜子杯喂仓鼠" @click="act('feed')"><HamsterProp :index="1"/></button>
        <HamsterProp class="hamster-generator" :style="place('generator')" :index="2"/>
        <HamsterProp class="hamster-seeds" :index="8"/>
        <HamsterProp class="hamster-cable" :index="11"/>
        <HamsterProp v-if="state.settings.hamsterSkin === 'summer'" class="hamster-fan" :index="3"/>
        <HamsterProp v-if="active && actionProp !== undefined && play.action !== 'sleep' && play.action !== 'feed'" :key="play.action" class="hamster-action-prop" :class="'prop-' + play.action" :index="actionProp"/>
        <button class="hamster-wheel-hit scene-hit" aria-label="轻点跑轮，陪仓鼠转一圈" @click="turnWheel"></button>
        <button class="hamster-pet-hit scene-hit" :aria-label="play.action === 'sleep' ? '唤醒仓鼠' : '摸摸仓鼠'" @click="pet"></button>
        <p v-if="!active" class="hamster-speech" :class="{ 'is-active': active }" aria-live="polite">{{ speech }}<PhHeart v-if="play.action === 'pet'" weight="fill"/></p>
        <button class="hamster-quota" :style="place('quota')" @click="togglePanel('details')" :class="'quota-' + level" type="button" :aria-label="percent === null ? '今日额度未知，' + statusLabel : '今日剩余额度 ' + Math.round(percent) + '%'">
          <span class="hamster-quota-label"><PhLightning weight="fill"/>今日剩余<span v-if="state.status === 'stale'"> · 数据待更新</span></span>
          <div><span class="hamster-meter" :class="{ unknown: percent === null }"><i :style="{ width: `${percent === null ? 0 : Math.max(0, Math.min(100, percent))}%` }"></i></span><strong>{{ percent === null ? '—' : Math.round(percent) + '%' }}</strong></div>
          <small>{{ usable && state.quota ? `¥${state.quota.remaining.toFixed(2)} / ¥${state.quota.limit.toFixed(2)}` : statusLabel }}</small>
        </button>
        <header class="hamster-header hamster-chrome"><span><PhLightning weight="fill"/><b>仓鼠动力机房</b></span><div><button aria-label="更多仓鼠互动" title="更多互动" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="仓鼠换装" title="换装" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhTShirt/></button><button aria-label="仓鼠设置" title="设置" @click="emit('settings')"><PhGearSix/></button><button aria-label="收起仓鼠到托盘" title="收起到托盘" @click="hide"><PhMinus/></button></div></header>
        <nav class="hamster-tools hamster-chrome" aria-label="陪仓鼠玩"><button v-for="item in interactions" :key="item.action" :aria-label="'仓鼠' + item.label" :title="item.label" @click="act(item.action)"><HamsterProp :index="item.prop"/><span>{{ item.label }}</span></button></nav>
        <footer class="hamster-footer hamster-chrome"><button :aria-expanded="panel === 'details'" @click="togglePanel('details')"><PhInfo/>{{ statusLabel }}</button><button aria-label="刷新仓鼠额度" :disabled="state.syncing || !state.quota" @click="refresh"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button><button v-if="!usable" :disabled="state.loginOpen" @click="login">{{ state.loginOpen ? '等待登录' : '连接账户' }}</button></footer>
        <div v-if="active" class="hamster-hud" :style="place('actionDock')" aria-live="polite">
          <div class="hamster-action-copy"><b>{{ play.action === 'wheel' ? (play.completedAt !== null ? '跑轮挑战完成！' : `跑轮 ${play.turns} / ${WHEEL_TARGET} 圈`) : actionLabel }}</b><small v-if="play.action === 'wheel'">{{ play.turns }} / {{ WHEEL_TARGET }} 圈</small><small v-else>{{ speech }}</small></div>
          <button v-if="play.action === 'wheel'" :disabled="play.completedAt !== null" @click="turnWheel">转一圈</button>
          <button :aria-label="play.action === 'sleep' ? '叫仓鼠醒来' : '结束仓鼠互动'" @click="cancel">{{ play.action === 'sleep' ? '醒来' : '结束' }}<PhX v-if="play.action !== 'sleep'"/></button>
        </div>
        <section v-if="panel" class="hamster-panel" role="dialog" :aria-label="panel === 'play' ? '仓鼠游乐场' : panel === 'wardrobe' ? '仓鼠衣橱' : '仓鼠额度详情'">
          <header><b>{{ panel === 'play' ? '忙里偷闲，陪鼠鼠玩' : panel === 'wardrobe' ? '今天穿什么？' : '今日额度' }}</b><button aria-label="关闭仓鼠面板" @click="closePanel"><PhX/></button></header>
          <template v-if="panel === 'play'"><div class="hamster-play-grid"><button v-for="item in interactions" :key="item.action" @click="act(item.action)"><HamsterProp :index="item.prop"/><b>{{ item.label }}</b><small>{{ item.hint }}</small></button><button @click="act('wheel')"><PhCircleDashed/><b>逗跑轮</b><small>一起转满六圈</small></button><button @click="act('pet')"><PhHandHeart weight="duotone"/><b>摸摸它</b><small>把一点喜欢告诉它</small></button></div><div class="hamster-cat-controls"><b>监工猫的摸鱼时间</b><button @click="act('cat-yawn')">打个哈欠</button><button @click="act('cat-nap')">趴着补觉</button><button @click="act('cat-snack')">偷吃瓜子</button></div><p>互动只是陪伴，不会消耗或恢复平台额度。</p></template>
          <template v-else-if="panel === 'wardrobe'"><HamsterSkinPicker/><p>装扮会保存。盖被休息时暂时收好，醒来继续穿。</p></template>
          <template v-else><p>{{ statusLabel }} · {{ state.message }}</p><dl v-if="state.quota"><div><dt>{{ usable ? '今日剩余' : '上次记录剩余' }}</dt><dd>¥{{ state.quota.remaining.toFixed(2) }}</dd></div><div><dt>每日额度</dt><dd>¥{{ state.quota.limit.toFixed(2) }}</dd></div><div><dt>费用日期</dt><dd>{{ state.quota.day }}</dd></div><div><dt>费用更新时间</dt><dd>{{ state.quota.estimatedAt.replace('T', ' ').slice(0, 19) }}</dd></div></dl><p>北京时间每日 00:00 重置，以平台同步结果为准。</p><button class="text-button" @click="api.openPortal()">在平台查看<PhArrowRight/></button></template>
        </section>
        <p v-if="notice" class="hamster-notice" role="status">{{ notice }}<button aria-label="关闭仓鼠提示" @click="notice = ''"><PhX/></button></p>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="hamster-resize" :class="corner" :aria-label="`缩放仓鼠 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="setting({ windowWidth: state.settings.windowWidth + 10 })" @keydown.down.prevent="setting({ windowWidth: state.settings.windowWidth - 10 })"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="hamster-intro"><span class="hamster-eyebrow"><PhLightning weight="fill"/> LITTLE PAWS. BIG ENERGY.</span><h1>每一份灵感，<br/>都有鼠鼠<span>在加油。</span></h1><p>小小的跑轮，装着今天大大的干劲。<br/>看看它的模样，就知道额度还剩多少。</p><div class="hamster-intro-note">“鼠鼠也有极限，<br/>但陪你的心意没有。”</div><div class="hamster-preview-actions"><button @click="act('feed')"><PhGrains/>请它吃颗瓜子</button><button @click="setting({ theme: night ? 'day' : 'night' })"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '切换白天' : '看看夜晚' }}</button></div><small>浏览器演示数据 · 互动不改变真实额度</small></aside>
    </div>
    <template v-if="!isDesktop"><section class="hamster-preview-section"><header><div><span>01 / DAILY ENERGY</span><h2>鼠鼠今天，是什么状态？</h2></div><small>点击切换演示额度</small></header><div class="hamster-states"><button v-for="item in states" :key="item.percent" :aria-label="'预览仓鼠' + item.percent + '%额度'" :aria-pressed="percent === item.percent" @click="demo(item.percent)"><div><HamsterVisual :skin="state.settings.hamsterSkin" :level="hamsterLevel(item.percent)" :reduced-motion="true"/><strong>{{ item.percent }}<small>%</small></strong></div><b>{{ item.label }}</b><span>{{ item.hint }}</span></button></div></section><section class="hamster-preview-section hamster-play-preview"><header><div><span>02 / A LITTLE BREAK</span><h2>工作暂停，可爱继续。</h2></div><small>短暂放空，也是一种认真</small></header><div><button v-for="item in interactions" :key="item.action" @click="act(item.action)"><HamsterProp :index="item.prop"/><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span><PhArrowRight/></button></div></section><section class="hamster-preview-section hamster-wardrobe-preview"><header><div><span>03 / LITTLE WARDROBE</span><h2>换身衣服，好心情开工。</h2></div></header><HamsterSkinPicker/></section></template>
  </div>
</template>
