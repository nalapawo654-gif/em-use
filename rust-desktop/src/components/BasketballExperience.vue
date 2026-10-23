<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { PhBasketball, PhGameController, PhGearSix, PhMinus, PhTShirt, PhX, PhHandPalm, PhArrowUpLeft, PhArrowRight, PhSun, PhMoon, PhSpeakerHigh, PhSpeakerSlash, PhArrowsClockwise } from '@phosphor-icons/vue'
import { api, quotaState as state, quotaDisplay, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import { evolution, systemReduced } from '../evolution/controller'
import type { Corner } from '../shared/windowGeometry'
import { COURT, DISTANCES, newRound, origin, launch, stepBall, finishShot, shotKind, aimFromPull, previewArc, station, type Ball, type Point } from '../basketball/game'
import BasketballPlayer from './BasketballPlayer.vue'
import BasketballCourt from './BasketballCourt.vue'
import BasketballBall from './BasketballBall.vue'
import BasketballProps from './BasketballProps.vue'
import BasketballWardrobe from './BasketballWardrobe.vue'
import PetArcToolbar from './PetArcToolbar.vue'
import PetEvolution from './PetEvolution.vue'
import PetNotices from './PetNotices.vue'
import PetCalendar from './PetCalendar.vue'
import CodexQuotaReadout from './CodexQuotaReadout.vue'
import QuotaDetails from './QuotaDetails.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), ballButton = ref<HTMLButtonElement>()
const panel = ref<'play' | 'wardrobe' | 'details' | null>(null), notice = ref('')
const mode = ref<'idle' | 'ready' | 'flying' | 'feedback' | 'finished'>('idle')
const round = ref(newRound(props.percent)), ball = shallowRef<Ball | null>(null)
const angle = ref(67), power = ref(410), aiming = ref(false), keyboardAim = ref(false), trail = ref<Point[]>([])
const message = ref('这个距离，也在射程之内。'), reaction = ref('idle'), sound = ref(false), paused = ref(false)
const calendarOpen = ref(false), noticeOpen = ref(false)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const active = computed(() => mode.value !== 'idle')
const gentle = computed(() => state.settings.reducedMotion || systemReduced.value)
const level = computed(() => active.value ? round.value.level : station(props.percent) ?? 1)
const practice = computed(() => active.value ? round.value.practice : station(props.percent) === null)
const launchPoint = computed(() => origin(level.value))
const position = computed(() => ball.value ?? launchPoint.value)
const arc = computed(() => previewArc(level.value, angle.value, power.value))
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '正在同步额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '等待登录' }[state.status]))
const pose = computed(() => aiming.value ? 'aim' : mode.value === 'flying' ? 'shoot' : reaction.value)
const jerseyAwake = computed(() => evolution.awake && evolution.scene === 'basketball')
let captured: { id: number; target: HTMLElement; start: Point } | null = null
let frame = 0, last = 0, accumulator = 0, feedbackTime = 0, reactionTime = 0, audio: AudioContext | null = null
function focusBall() { void nextTick(() => ballButton.value?.focus({ preventScroll: true })) }
function releaseCapture() {
  const current = captured; captured = null; aiming.value = false
  if (current?.target.hasPointerCapture(current.id)) current.target.releasePointerCapture(current.id)
}
function start() {
  releaseCapture(); panel.value = null; notice.value = ''; round.value = newRound(props.percent); ball.value = null; trail.value = []
  mode.value = 'ready'; reaction.value = 'idle'; keyboardAim.value = false; feedbackTime = 0; accumulator = 0
  message.value = '按住球向左下拉，松手投出'; focusBall()
}
function stop() {
  releaseCapture(); mode.value = 'idle'; ball.value = null; trail.value = []; reaction.value = 'idle'; keyboardAim.value = false
  message.value = '这个距离，也在射程之内。'; accumulator = 0
}
function escape() { panel.value = null; notice.value = ''; stop(); void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function togglePanel(value: NonNullable<typeof panel.value>) { const closing = panel.value === value; stop(); panel.value = closing ? null : value; notice.value = ''; if (closing) void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function highFive() { if (active.value || panel.value) return; reaction.value = 'wave'; reactionTime = 1.2; message.value = '好球，一会儿一起上场！'; schedule() }
async function run(task: () => Promise<unknown>, error: string, preview = '') { try { await task(); if (!isDesktop && preview) notice.value = preview } catch { notice.value = error } }
function settings() { escape(); emit('settings') }
function tone(kind: 'launch' | 'bounce' | 'score') {
  if (!sound.value) return
  try {
    audio ??= new AudioContext(); void audio.resume().catch(() => {})
    const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.type = kind === 'score' ? 'sine' : 'triangle'
    oscillator.frequency.setValueAtTime(kind === 'score' ? 650 : kind === 'bounce' ? 170 : 280, now)
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'score' ? 950 : 65, now + .12)
    gain.gain.setValueAtTime(.045, now); gain.gain.exponentialRampToValueAtTime(.001, now + .17)
    oscillator.start(); oscillator.stop(now + .18); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  } catch { sound.value = false }
}
function shoot() {
  if (mode.value !== 'ready' || panel.value || paused.value) return
  releaseCapture(); keyboardAim.value = false; ball.value = launch(level.value, angle.value, power.value); trail.value = []
  mode.value = 'flying'; reaction.value = 'idle'; accumulator = 0; message.value = '看这条弧线。'; tone('launch'); schedule()
}
function point(event: PointerEvent): Point {
  const rect = widget.value!.getBoundingClientRect()
  return { x: (event.clientX - rect.left) / rect.width * 440, y: (event.clientY - rect.top) / rect.height * 440 }
}
function grab(event: PointerEvent) {
  if (event.button !== 0 || mode.value !== 'ready' || panel.value || captured || paused.value) return
  event.preventDefault(); const target = event.currentTarget as HTMLElement
  captured = { id: event.pointerId, target, start: point(event) }; target.setPointerCapture(event.pointerId)
  aiming.value = true; keyboardAim.value = false
}
function pull(event: PointerEvent) {
  if (!captured || captured.id !== event.pointerId) return
  const p = point(event), aim = aimFromPull(p.x - captured.start.x, p.y - captured.start.y)
  angle.value = Math.round(aim.angle); power.value = Math.round(aim.power)
}
function release(event: PointerEvent) {
  if (!captured || event.pointerId !== captured.id) return
  const p = point(event), dx = p.x - captured.start.x, dy = p.y - captured.start.y
  const valid = Math.hypot(dx, dy) >= 6 && dx <= 1 && dy >= 2
  releaseCapture(); if (valid) shoot(); else message.value = '向左下拉开一点，再松手。'
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); escape(); return }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(event.key)) event.preventDefault(); else return
  if (event.repeat && [' ', 'Enter'].includes(event.key)) return
  if (mode.value === 'idle' || mode.value === 'finished') { if ([' ', 'Enter'].includes(event.key)) start(); return }
  if (mode.value !== 'ready') return
  keyboardAim.value = true
  if (event.key === 'ArrowLeft') angle.value = Math.min(85, angle.value + 2)
  if (event.key === 'ArrowRight') angle.value = Math.max(20, angle.value - 2)
  if (event.key === 'ArrowUp') power.value = Math.min(570, power.value + 10)
  if (event.key === 'ArrowDown') power.value = Math.max(120, power.value - 10)
  if (event.key === ' ' || event.key === 'Enter') shoot()
}
function finish() {
  const b = ball.value!; const result = shotKind(b); round.value = finishShot(round.value, b)
  reaction.value = result === 'miss' ? 'miss' : 'celebrate'
  message.value = result === 'swish' ? `空心！+${DISTANCES[level.value]!.points + 1} 分` : result === 'bank' ? `擦板命中！+${DISTANCES[level.value]!.points} 分` : result === 'rim' ? `颠进去了！+${DISTANCES[level.value]!.points} 分` : b.rim ? '就差一点，篮圈说下次。' : b.board ? '碰板了，再调一点角度。' : b.x < COURT.left ? '短了一点，再多给点力。' : '飞远了，下次收一点力。'
  mode.value = 'feedback'; feedbackTime = .8
}
function tick(time: number) {
  const delta = last ? Math.min((time - last) / 1000, .05) : 0; last = time
  if (!paused.value) {
    if (mode.value === 'flying' && ball.value) {
      accumulator += delta
      while (accumulator >= 1 / 120 && mode.value === 'flying') {
        const previous = ball.value!; ball.value = stepBall(previous, 1 / 120); accumulator -= 1 / 120
        if ((!previous.rim && ball.value.rim) || (!previous.board && ball.value.board) || (previous.groundAt === null && ball.value.groundAt !== null)) tone('bounce')
        if (!previous.scored && ball.value.scored) tone('score')
        if (ball.value.done) finish()
      }
      if (!gentle.value) trail.value = [...trail.value.slice(-7), { x: ball.value!.x, y: ball.value!.y }]
    } else if (mode.value === 'feedback') {
      feedbackTime -= delta
      if (feedbackTime <= 0) { ball.value = null; trail.value = []; mode.value = round.value.shots === 10 ? 'finished' : 'ready'; if (mode.value === 'ready') focusBall(); else void nextTick(() => widget.value?.querySelector<HTMLButtonElement>('.hoop-result .hoop-primary')?.focus({ preventScroll: true })) }
    }
    if (reactionTime > 0) { reactionTime -= delta; if (reactionTime <= 0) { reaction.value = 'idle'; message.value = '这个距离，也在射程之内。' } }
  }
  if (mode.value === 'flying' || mode.value === 'feedback' || reactionTime > 0) frame = requestAnimationFrame(tick)
  else { frame = 0; last = 0 }
}
function schedule() { if (!frame && !paused.value) { last = 0; frame = requestAnimationFrame(tick) } }
function blur() { releaseCapture() }
function visibility() { releaseCapture(); paused.value = document.hidden; last = 0; accumulator = 0; cancelAnimationFrame(frame); frame = 0; if (!paused.value && (mode.value === 'flying' || mode.value === 'feedback' || reactionTime > 0)) schedule() }
watch(() => state.settings.windowWidth, releaseCapture)
watch([() => state.settings.quotaSource, () => state.settings.codexBucket, () => state.codex?.account?.id, () => state.account?.id], () => { stop() })
watch(moving, value => { if (value) releaseCapture() })
async function demo(value: number | null) {
  if (isDesktop) return
  if (state.settings.quotaSource === 'codex') { await api.settings({ codexEnabled: value !== null }); if (value !== null) previewQuota(value) }
  else if (value === null) await api.logout(); else previewQuota(value)
}
onMounted(() => { paused.value = document.hidden; document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', blur) })
onUnmounted(() => { releaseCapture(); cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', blur); void audio?.close().catch(() => {}) })
</script>
<template>
  <div class="hoop-experience" :class="{ 'hoop-native': isDesktop }">
    <div class="hoop-hero">
      <section ref="widget" class="hoop-widget pet-arc-host" tabindex="-1" aria-label="桌角神射手投篮场景" :class="{ 'has-panel': panel, 'has-action': active, 'is-moving': moving, 'calendar-is-open': calendarOpen, 'hoop-gentle': gentle, 'hoop-aiming': aiming, 'hoop-awake': jerseyAwake }" :data-mode="mode" :data-evolution-phase="evolution.phase" :data-level="level" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <PetEvolution :blocked="active || !!panel || moving || noticeOpen || calendarOpen"/>
        <PetNotices :blocked="active || !!panel || moving || !!notice" :message-blocked="active || !!panel || moving || !!notice" :external-blocked="calendarOpen" :external-deferred="!!state.calendar?.active.length" @open-change="noticeOpen = $event"><template #parcel><BasketballProps kind="locker" class="hoop-mail message-prop-motion"/></template></PetNotices>
        <PetCalendar appearance="basketball" :blocked="active || !!panel || moving || noticeOpen" @open-change="calendarOpen = $event"/>
        <svg class="hoop-court" viewBox="0 0 440 440" aria-hidden="true">
          <BasketballCourt :scored="ball?.scored"/>
          <path v-if="aiming || keyboardAim" :d="'M' + arc.map(p => p.x + ',' + p.y).join(' L')" stroke="#e77a4b" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 7" fill="none"/>
          <g v-if="!gentle && mode === 'flying'"><circle v-for="(p, i) in trail" :key="i" :cx="p.x" :cy="p.y" :r="2 + i * .7" :fill="round.streak >= 3 ? '#f5893c' : '#c09c70'" :opacity="i / 40"/></g>
          <BasketballPlayer :x="launchPoint.x - 76" y="213" width="104" height="127" :skin="state.settings.basketballSkin" :pose="pose" :gentle="gentle || moving || paused" :awake="jerseyAwake"/>
          <g :transform="`translate(${position.x} ${position.y}) rotate(${ball ? ball.elapsed * 260 : 0})`" class="hoop-ball-art" :class="{ 'idle-dribble': mode === 'idle' && !gentle && !panel && !moving }"><BasketballBall/></g>
          <path d="M318 176q22 7 44 0" stroke="#a34c30" stroke-width="4" fill="none"/>
          <path d="M318 175.6q22 6.5 44 0" stroke="#ed9560" stroke-width="2.2" fill="none"/>
          <path d="M321 175.8q19 5.2 38 0" stroke="#ffd2a0" stroke-width=".65" fill="none"/>
          <text :x="launchPoint.x - 12" y="359" text-anchor="middle" font-size="9" fill="currentColor" letter-spacing="1">{{ practice ? '练习站位' : DISTANCES[level]!.label }}</text>
        </svg>
        <button class="hoop-player-hit scene-hit" :style="{ left: (launchPoint.x - 71) / 4.4 + '%' }" :disabled="!!panel || calendarOpen || noticeOpen" aria-label="和小球员击掌，也可拖动移动桌宠" @click="highFive"></button>
        <button ref="ballButton" class="hoop-ball-hit" data-pet-gesture :style="{ left: launchPoint.x / 4.4 + '%', top: launchPoint.y / 4.4 + '%' }" :disabled="!!panel || calendarOpen || noticeOpen || ['flying','feedback','finished'].includes(mode)" :aria-label="mode === 'idle' ? '点击篮球，开始十球挑战' : '投篮：向左下拉球松手出手，或左右调角度、上下调力度、空格出手'" @pointerdown.stop="grab" @pointermove.stop="pull" @pointerup.stop="release" @pointercancel="releaseCapture" @lostpointercapture="releaseCapture" @keydown.stop="key" @click="mode === 'idle' && start()"><span v-if="mode === 'idle'" class="hoop-start-tag">来一局</span></button>
        <p v-if="!active && !panel" class="hoop-speech">{{ message }}</p>
        <div v-if="active && mode !== 'finished'" class="hoop-scoreboard" data-pet-gesture><div><span>本局得分</span><strong>{{ round.score.toString().padStart(2, '0') }}</strong></div><div><span>剩余球数</span><b>{{ 10 - round.shots - Number(mode === 'flying') }}</b></div><div><span>连续命中</span><b>{{ round.streak }}</b></div><button aria-label="结束本局投篮" @click="escape"><PhX/></button><div class="hoop-shot-dots"><i v-for="n in 10" :key="n" :class="{ hit: round.results[n - 1] && round.results[n - 1] !== 'miss', miss: round.results[n - 1] === 'miss', next: n === round.shots + 1 }"></i></div></div>
        <div v-if="active && mode !== 'finished'" class="hoop-instruction" data-pet-gesture><span role="status" aria-live="polite">{{ aiming || keyboardAim ? `${angle}° · 力度 ${Math.round((power - 120) / 450 * 100)}%` : message }}</span><small v-if="!aiming && !keyboardAim">{{ practice ? '额度未知 · 中距离练习' : `${DISTANCES[level]!.label} · 本局站位已锁定` }}</small><button :aria-label="sound ? '关闭投篮音效' : '开启投篮音效'" :aria-pressed="sound" @click="sound = !sound"><PhSpeakerHigh v-if="sound"/><PhSpeakerSlash v-else/></button></div>
        <section v-if="mode === 'finished'" class="hoop-result" data-pet-gesture role="dialog" aria-label="十球挑战成绩"><button class="hoop-result-dismiss" aria-label="关闭投篮成绩" @click="escape"><PhX/></button><span>FINAL SCORE / 十球挑战</span><h2>{{ round.score }}<small>分</small></h2><p>{{ practice ? '中距离练习' : DISTANCES[level]!.label }} · {{ round.hits >= 7 ? '今天手感滚烫！' : round.hits >= 3 ? '下一球，会更漂亮。' : '手感是慢慢练出来的。' }}</p><div class="hoop-result-stats"><span><b>{{ round.hits }}/10</b>命中</span><span><b>{{ round.swishes }}</b>空心</span><span><b>{{ round.best }}</b>最长连进</span></div><button class="hoop-primary" @click="start">再来一局 <PhArrowRight/></button><button class="hoop-result-close" @click="escape">结束，回到桌边</button></section>
        <button class="hoop-quota" data-pet-gesture :disabled="noticeOpen || calendarOpen" :aria-expanded="panel === 'details'" aria-label="查看投篮桌宠额度详情" @click="togglePanel('details')"><CodexQuotaReadout compact><span>{{ quotaDisplay.label }}</span><strong>{{ percent === null ? '—' : Math.round(percent) + '%' }}</strong><small>{{ percent === null || state.status !== 'ready' ? statusLabel : quotaDisplay.subtitle }}</small></CodexQuotaReadout></button>
        <PetArcToolbar scene="basketball" label="桌角神射手" :blocked="active || noticeOpen || calendarOpen"><template #controls><button aria-label="投篮更多玩法" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="投篮球衣" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhTShirt/></button><button aria-label="投篮桌宠设置" @click="settings"><PhGearSix/></button><button aria-label="收起投篮桌宠到托盘" @click="run(() => api.hide(), '收起失败，请重试。', '桌面版可收起到系统托盘。')"><PhMinus/></button></template><button aria-label="开始十球挑战" @click="start"><PhBasketball/><span>投篮</span></button><button aria-label="和小球员击掌" @click="highFive"><PhHandPalm/><span>击掌</span></button><button aria-label="刷新投篮额度" :disabled="state.syncing || !quotaDisplay.canRefresh" @click="run(() => api.refresh(), '刷新失败，请重试。')"><PhArrowsClockwise/><span>刷新</span></button></PetArcToolbar>
        <section v-if="panel" class="hoop-panel" data-pet-gesture role="dialog" :aria-label="panel === 'wardrobe' ? '投篮球衣衣橱' : panel === 'play' ? '投篮玩法' : '投篮额度详情'"><header><b>{{ panel === 'wardrobe' ? '今天，穿哪队球衣？' : panel === 'play' ? '休息一下，上场投两球。' : '额度详情' }}</b><button aria-label="关闭投篮面板" @click="escape"><PhX/></button></header><div class="hoop-panel-scroll"><BasketballWardrobe v-if="panel === 'wardrobe'"/><template v-else-if="panel === 'play'"><button class="hoop-primary" @click="start"><PhBasketball/>开始十球挑战</button><p>按住篮球往左下拉，松手出手。向后拉得越远，力度越大。</p><p>键盘：聚焦篮球，← → 调角度，↑ ↓ 调力度，空格出手，Esc 结束。</p><p>距离对应 2 / 3 / 4 / 5 分，空心额外加 1 分。每局固定站位，投完 10 球结算。</p><small>游戏不消耗或恢复真实额度。</small></template><QuotaDetails v-else/></div></section>
        <p v-if="notice" class="hoop-notice" data-pet-gesture role="status">{{ notice }}<button aria-label="关闭投篮提示" @click="notice = ''"><PhX/></button></p>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="hoop-resize" :class="corner" :aria-label="`缩放投篮桌宠 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="run(() => api.settings({ windowWidth: state.settings.windowWidth + 10 }), '大小未能保存。')" @keydown.down.prevent="run(() => api.settings({ windowWidth: state.settings.windowWidth - 10 }), '大小未能保存。')"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="hoop-intro"><span class="hoop-eyebrow"><i></i> DESKTOP HOOPS CLUB · 014</span><h1>再远，<br/>也在<span>射程之内。</span></h1><p>额度少一点，站位远一点。<br/>工作暂停一小会儿，来一记漂亮的空心。</p><div class="hoop-intro-actions"><button class="hoop-primary" @click="start"><PhBasketball/>上场，投十球<PhArrowRight/></button><button class="hoop-theme" aria-label="切换投篮昼夜" @click="run(() => api.settings({ theme: night ? 'day' : 'night' }), '昼夜设置未能保存。')"><PhSun v-if="night"/><PhMoon v-else/></button></div><div class="hoop-coach"><b>COACH'S NOTE</b><span>按住球向左下拉，松手投出。<br/>空心 +1 分，下一球靠你。</span></div><small>浏览器演示额度 · 桌面版连接账户同步真实数据</small></aside>
    </div>
    <section v-if="!isDesktop" class="hoop-preview"><header><div><span>01 / FIND YOUR RANGE</span><h2>额度变了，挑战也跟着变。</h2></div><button @click="demo(null)">未知额度 · 练习模式</button></header><div class="hoop-distance-cards"><button v-for="(item, i) in DISTANCES" :key="item.label" :aria-pressed="station(percent) === i" @click="demo([100,75,50,25][i]!)"><span>0{{ i + 1 }} <b>{{ [100,75,50,25][i] }}%</b></span><svg viewBox="0 0 180 46" aria-hidden="true"><path d="M8 36H168m-8-2V8h-16m-8 9h24" fill="none" stroke="currentColor" stroke-width="2"/><circle :cx="110 - i * 30" cy="26" r="6" fill="#e77846"/><path :d="`M${110 - i * 30} 26Q110 -5 144 16`" fill="none" stroke="currentColor" stroke-dasharray="3 4"/></svg><strong>{{ item.label }}</strong><small>命中 {{ item.points }} 分 · 空心 {{ item.points + 1 }} 分</small></button></div><footer><span>每局 10 球 / 无倒计时 / 距离在开局时锁定</span><span>EM USE · TAKE A SHOT, TAKE A BREAK.</span></footer></section>
  </div>
</template>
