<script setup lang="ts">
import PetNotices from './PetNotices.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhBatteryCharging, PhGearSix, PhMinus, PhGameController, PhTShirt, PhX, PhInfo, PhArrowsClockwise, PhArrowUpLeft, PhSun, PhMoon, PhArrowRight, PhHeart, PhBarbell, PhPersonSimpleRun, PhYinYang, PhMusicNotes, PhFlowerLotus } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import { BATTERY_REALMS } from '../shared/types'
import { BATTERY_LEVELS, batteryLevel, batteryIdle, beginBattery, advanceBattery, liftBattery, canExercise, isBatteryExercise, LIFT_TARGET, type BatteryAction } from '../battery/play'
import BatteryVisual from './BatteryVisual.vue'
import BatteryProp from './BatteryProp.vue'
import BatteryWardrobe from './BatteryWardrobe.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), panel = ref<'play' | 'wardrobe' | 'details' | null>(null), notice = ref('')
const play = ref(batteryIdle()), visible = ref(!document.hidden)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const level = computed(() => batteryLevel(props.percent)), active = computed(() => play.value.action !== 'idle')
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '同步今日额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '等待登录' }[state.status]))
const interactions: { action: BatteryAction; label: string; hint: string; prop?: number; icon?: typeof PhHeart }[] = [
  { action: 'lift', label: '陪练举铁', hint: '一起完成六次举铁', prop: 8 },
  { action: 'rope', label: '跳绳时间', hint: '有多少力，跳多高', icon: PhPersonSimpleRun },
  { action: 'charge', label: '接上充电', hint: '接上电流，放松一下', prop: 18 },
  { action: 'towel', label: '擦擦汗', hint: '认真运动也要照顾自己', prop: 11 },
  { action: 'cheer', label: '击掌打气', hint: '你已经很棒啦', icon: PhHeart },
  { action: 'rest', label: '躺平休息', hint: '休息是正经事', prop: 10 },
  { action: 'taichi', label: '打一套太极', hint: '云手推掌，慢慢舒展', icon: PhYinYang },
  { action: 'aerobics', label: '跳健美操', hint: '左右踏步，伸展抬臂', icon: PhMusicNotes },
  { action: 'yoga', label: '做会儿瑜伽', hint: '树式平衡，侧身伸展', icon: PhFlowerLotus },
]
const quickInteractions = ['lift', 'charge', 'taichi', 'aerobics', 'yoga', 'rest'].map(action => interactions.find(item => item.action === action)!)
const states = [{ percent: 100, label: '元气蹦蹦跳' }, { percent: 75, label: '轻快小跑' }, { percent: 50, label: '还能再练练' }, { percent: 25, label: '坐着伸伸腿' }, { percent: 20, label: '真的动不啦' }, { percent: 15, label: '今日已躺平' }]
const speech = computed(() => play.value.action === 'idle' ? BATTERY_LEVELS[level.value].speech : ({ lift: play.value.completedAt !== null ? '六次完成！给你一枚小奖章。' : '你点一下，我举一次！', rope: props.percent! <= 25 ? '小步跨绳，也算今天动过啦。' : '一、二、三，跳出好心情！', charge: '电流接通～充电特效不改变真实额度。', taichi: '起势、云手、推掌，慢下来。', aerobics: '左一步，右一步，跟着节拍动起来！', yoga: '站稳，伸展，呼——吸。', towel: '擦掉汗水，留下成就感。', cheer: '啪！和你击个掌。', rest: '今天也辛苦啦，先躺一会儿。' }[play.value.action]))
const realm = computed(() => BATTERY_REALMS.find(r => r.id === state.settings.batteryRealm)!)
function focusWidget() { void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function act(action: BatteryAction) {
  panel.value = null; notice.value = ''
  if (isBatteryExercise(action) && !canExercise(props.percent)) { notice.value = level.value === 'unknown' ? '电量还没同步，先陪它休息一下。' : '电量耗尽，今天先休息。'; focusWidget(); return }
  play.value = beginBattery(action, performance.now(), props.percent); focusWidget()
}
function cancel() { play.value = batteryIdle(); focusWidget() }
function escape() { panel.value = null; notice.value = ''; cancel() }
function pet() { if (play.value.action === 'rest') cancel(); else act('cheer') }
function lift() { play.value = liftBattery(play.value, performance.now()) }
function togglePanel(value: NonNullable<typeof panel.value>) { panel.value = panel.value === value ? null : value; notice.value = ''; if (!panel.value) focusWidget() }
function closePanel() { panel.value = null; focusWidget() }
function demo(percent: number | null) { if (isDesktop) return; notice.value = ''; play.value = batteryIdle(); if (percent === null) void api.logout(); else previewQuota(percent) }
async function login() { try { await api.login(); if (!isDesktop) notice.value = '请在桌面客户端完成官方登录。' } catch { notice.value = '登录窗口未能打开，请重试。' } }
async function refresh() { try { await api.refresh() } catch { notice.value = '刷新失败，请稍后重试。' } }
async function hide() { try { await api.hide(); if (!isDesktop) notice.value = '桌面版可收起到系统托盘。' } catch { notice.value = '收起失败，请重试。' } }
async function theme() { try { await api.settings({ theme: props.night ? 'day' : 'night' }) } catch { notice.value = '昼夜设置保存失败，请重试。' } }
function visibility() { visible.value = !document.hidden; if (!visible.value && play.value.action !== 'rest') play.value = batteryIdle() }
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { if (visible.value) play.value = advanceBattery(play.value, performance.now(), props.percent) }, 60); document.addEventListener('visibilitychange', visibility) })
watch(() => props.percent, () => { notice.value = ''; play.value = advanceBattery(play.value, performance.now(), props.percent) })
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility) })
</script>
<template>
  <div class="battery-experience" :class="{ 'battery-native': isDesktop }">
    <div class="battery-hero">
      <section ref="widget" tabindex="-1" class="battery-widget" :class="{ 'has-panel': panel, 'has-action': active, 'has-notice': notice, 'is-moving': moving }" :style="{ '--battery-charge': BATTERY_LEVELS[level].color }" aria-label="健身电池人场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <PetNotices :blocked="!!panel || active || moving || !!notice"/>
        <BatteryVisual :percent="percent" :skin="state.settings.batterySkin" :realm="state.settings.batteryRealm" :play="play" :night="night" :scenery="true" :reduced-motion="state.settings.reducedMotion" :active="visible"/>
        <button class="battery-body-hit scene-hit" :class="{ lying: play.action === 'rest' || (level === 'empty' && play.action !== 'charge') }" :aria-label="play.action === 'rest' ? '叫电池人起床' : '和电池人击掌'" @click="pet"></button>
        <p v-if="!active" class="battery-speech" aria-live="polite">{{ speech }}</p>
        <button class="battery-quota" :class="'charge-' + level" :aria-label="'电池人今日剩余额度 ' + (percent === null ? '未知' : Math.round(percent) + '%') + '，' + statusLabel" :aria-expanded="panel === 'details'" @click="togglePanel('details')"><span><PhBatteryCharging weight="fill"/>今日剩余</span><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong><i class="battery-meter"><i :style="{ width: (percent === null ? 0 : Math.max(0, Math.min(100, percent))) + '%' }"></i></i><small>{{ usable && state.quota ? `¥${state.quota.remaining.toFixed(2)}` : statusLabel }}</small><em v-if="state.status === 'stale'">数据待更新</em></button>
        <span class="battery-realm-caption">{{ realm.label }} <i>·</i> {{ BATTERY_LEVELS[level].label }}</span>
        <header class="battery-header battery-chrome"><span><PhBatteryCharging weight="duotone"/><b>健身电池人</b></span><div><button aria-label="电池人更多玩法" title="更多玩法" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="电池人换装与场景" title="换装与场景" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhTShirt/></button><button aria-label="电池人设置" title="设置" @click="emit('settings')"><PhGearSix/></button><button aria-label="收起电池人到托盘" title="收起到托盘" @click="hide"><PhMinus/></button></div></header>
        <nav class="battery-tools battery-chrome" aria-label="电池人常用互动"><button v-for="item in quickInteractions" :key="item.action" :aria-label="'电池人' + item.label" @click="act(item.action)"><BatteryProp v-if="item.prop !== undefined" :index="item.prop"/><component v-else :is="item.icon"/><span>{{ item.label }}</span></button></nav>
        <footer class="battery-footer battery-chrome"><button @click="togglePanel('details')"><PhInfo/>{{ statusLabel }}</button><button aria-label="刷新电池人额度" :disabled="state.syncing || !state.quota" @click="refresh"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button><button v-if="!usable" :disabled="state.loginOpen" @click="login">{{ state.loginOpen ? '等待登录' : '连接账户' }}</button></footer>
        <div v-if="active" class="battery-hud" aria-live="polite"><div><b>{{ play.action === 'lift' ? (play.completedAt !== null ? '六次完成！' : `陪练举铁 ${play.reps} / ${LIFT_TARGET}`) : interactions.find(i => i.action === play.action)?.label }}</b><small>{{ speech }}</small><progress v-if="play.action === 'lift'" :value="play.reps" :max="LIFT_TARGET" aria-label="举铁完成次数"></progress></div><button v-if="play.action === 'lift'" :disabled="play.completedAt !== null || Number.isFinite(play.lastRep)" @click="lift">{{ Number.isFinite(play.lastRep) ? '举起…' : '举一次' }}</button><button :aria-label="play.action === 'rest' ? '电池人起床' : '结束电池人互动'" @click="cancel">{{ play.action === 'rest' ? '起床' : '结束' }}</button></div>
        <section v-if="panel" class="battery-panel" role="dialog" :aria-label="panel === 'wardrobe' ? '电池人衣橱' : panel === 'play' ? '电池人健身计划' : '电池人额度详情'"><header><b>{{ panel === 'wardrobe' ? '今天，换个状态。' : panel === 'play' ? '和电池人一起动一动' : '今日平台额度' }}</b><button aria-label="关闭电池人面板" @click="closePanel"><PhX/></button></header><template v-if="panel === 'wardrobe'"><BatteryWardrobe/></template><template v-else-if="panel === 'play'"><div class="battery-play-grid"><button v-for="item in interactions" :key="item.action" @click="act(item.action)"><BatteryProp v-if="item.prop !== undefined" :index="item.prop"/><component v-else :is="item.icon"/><b>{{ item.label }}</b><small>{{ item.hint }}</small></button></div><p>运动、充电和休息均为陪伴特效，不消耗或恢复真实额度。</p></template><template v-else><p>{{ statusLabel }} · {{ state.message }}</p><dl v-if="state.quota"><div><dt>{{ usable ? '今日剩余' : '上次记录剩余' }}</dt><dd>¥{{ state.quota.remaining.toFixed(2) }}</dd></div><div><dt>每日额度</dt><dd>¥{{ state.quota.limit.toFixed(2) }}</dd></div><div><dt>费用日期</dt><dd>{{ state.quota.day }}</dd></div><div><dt>费用更新时间</dt><dd>{{ state.quota.estimatedAt.replace('T', ' ').slice(0, 19) }}</dd></div></dl><p>电池人的电量代表平台剩余额度；以服务端费用日期为准。</p><button class="battery-inline-link" @click="api.openPortal()">前往平台核对 <PhArrowRight/></button></template></section>
        <div v-if="notice" class="battery-notice" role="status"><span>{{ notice }}</span><button aria-label="关闭电池人提示" @click="notice = ''"><PhX/></button></div>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="battery-resize" :class="corner" :aria-label="`缩放电池人 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="api.settings({ windowWidth: state.settings.windowWidth + 10 })" @keydown.down.prevent="api.settings({ windowWidth: state.settings.windowWidth - 10 })"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="battery-intro"><span class="battery-eyebrow"><i></i> LITTLE BATTERY · BIG ENERGY</span><h1>电量有限，<br/><em>快乐满格。</em></h1><p>桌角来了一位健身搭子。<br/>电量足，就蹦蹦跳跳；没力气，就陪你歇歇。</p><div class="battery-handwriting">每一次努力，都值得一个击掌。<PhHeart weight="fill"/></div><div class="battery-preview-actions"><button @click="act('lift')"><PhBarbell/>陪它练一组<PhArrowRight/></button><button @click="theme"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '切到白天' : '夜晚陪伴' }}</button></div><small>浏览器演示数据 · 桌面版连接账户后同步真实额度</small></aside>
    </div>
    <template v-if="!isDesktop">
      <section class="battery-preview-section"><header><div><span>01 / ENERGY DIARY</span><h2>从满格，到好好休息。</h2></div><button class="battery-unknown-demo" @click="demo(null)" :aria-pressed="percent === null">预览未知电量 · —</button></header><div class="battery-states"><button v-for="item in states" :key="item.percent" :aria-pressed="percent === item.percent" @click="demo(item.percent)"><div><BatteryVisual :percent="item.percent" :skin="state.settings.batterySkin" :reduced-motion="true"/><strong :style="{ color: BATTERY_LEVELS[batteryLevel(item.percent)].color }">{{ item.percent }}<small>%</small></strong></div><b>{{ item.label }}</b></button></div></section>
      <section class="battery-preview-section battery-preview-play"><header><div><span>02 / TAKE A LITTLE BREAK</span><h2>工作之外，还有这些小快乐。</h2></div><small>点一下，陪它玩。</small></header><div><button v-for="item in interactions" :key="item.action" @click="act(item.action)"><BatteryProp v-if="item.prop !== undefined" :index="item.prop"/><component v-else :is="item.icon"/><span><b>{{ item.label }}</b><small>{{ item.hint }}</small></span><PhArrowRight/></button></div></section>
      <section class="battery-preview-section battery-preview-wardrobe"><header><div><span>03 / DRESS FOR THE DAY</span><h2>熟悉的电池，不一样的小性格。</h2></div></header><BatteryWardrobe/></section>
      <footer class="battery-preview-footer"><span><PhBatteryCharging/>打工电池 · 每一格，都认真生活。</span><span>Work hard. Rest well. <PhHeart weight="fill"/></span></footer>
    </template>
  </div>
</template>
