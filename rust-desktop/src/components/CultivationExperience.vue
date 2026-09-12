<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhSparkle, PhGearSix, PhMinus, PhGameController, PhX, PhInfo, PhArrowsClockwise, PhMoon, PhSun, PhMountains, PhHeart, PhArrowUpLeft, PhTShirt, PhShuffle } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import { CULTIVATION_ACCESSORIES, CULTIVATION_TREASURES } from '../shared/types'
import type { Settings } from '../shared/types'
import { CULTIVATION_ACTIONS as actions, CULTIVATION_LEVELS as levels, cultivationLevel, cultivationIdle, beginCultivation, advanceCultivation, lightSeal, combStroke, type CultivationAction } from '../cultivation/play'
import { PRACTICES, createTraining, shuffleTraining, advanceTraining, trainingPose, islandForRealm, encounterPhase, startEncounter, type EncounterKind, ENCOUNTERS, encounterDuration, encounterActorPose, practiceForEncounter } from '../cultivation/training'
import CultivatorMotion from './CultivatorMotion.vue'
import CultivationEncounter from './CultivationEncounter.vue'
import CultivationCrane from './CultivationCrane.vue'
import CultivationIncense from './CultivationIncense.vue'
import { createAmbience, advanceAmbience, showIncense } from '../cultivation/ambience'
import CultivationTraining from './CultivationTraining.vue'
import CultivationMaterial from './CultivationMaterial.vue'
import CultivationWardrobe from './CultivationWardrobe.vue'
import CultivatorSprite from './CultivatorSprite.vue'
import CultivationProp from './CultivationProp.vue'
import CultivationRealmPicker from './CultivationRealmPicker.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const widget = ref<HTMLElement>(), panel = ref<'play' | 'details' | 'realm' | 'wardrobe' | null>(null), notice = ref('')
const play = ref(cultivationIdle()), visible = ref(!document.hidden)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw','ne','sw','se']
const level = computed(() => cultivationLevel(props.percent)), active = computed(() => play.value.action !== 'idle')
const training = ref(createTraining(state.settings.cultivationRealm))
const ambience = ref(createAmbience())
const realm = computed(() => training.value.realm)
const practice = computed(() => PRACTICES.find(p=>p.id===training.value.practice)!)
const event = computed(()=>active.value ? null : training.value.encounter)
const trainingActive = computed(()=>!active.value && !panel.value && !event.value)
const trainingBackdrop = computed(()=>!!event.value && !['golden-pill','furnace-pop','runaway-sword'].includes(event.value.kind) && ['alchemy','stargaze'].includes(training.value.practice))
const motionRunning = computed(()=>visible.value && !state.settings.reducedMotion && !panel.value && !moving.value)
const incenseVisible = computed(()=>showIncense(training.value.practice,active.value))
const gentle = computed(()=>active.value || event.value?.kind==='drowsy' || !['full','settling'].includes(level.value))
function previewEncounter(kind: EncounterKind) {
  if(isDesktop)return
  cancel();panel.value=null
  training.value=startEncounter({...training.value,practice:practiceForEncounter(kind,training.value.practice)},kind)
}
function dismissEncounter() { training.value={...training.value,encounter:null,encounterRemaining:26000};focusWidget() }
const encounterStyle = computed(()=>event.value ? {'--story-time':`${(-event.value.elapsed).toFixed(1)}ms`,'--story-duration':`${encounterDuration(event.value)}ms`} : {})
const actorFrame = computed(()=> {
  if(!['full','settling'].includes(level.value))return levels[level.value].frame
  if(event.value)return encounterActorPose(event.value,level.value)
  if(active.value)return ['talisman','incense','tea','peach'].includes(play.value.action)?4:0
  return trainingPose(level.value,training.value.practice,training.value.elapsed,state.settings.reducedMotion)
})
const accessory = computed(()=>CULTIVATION_ACCESSORIES.find(a=>a.id===state.settings.cultivationAccessory)?.prop ?? null)
const treasure = computed(()=>CULTIVATION_TREASURES.find(a=>a.id===state.settings.cultivationTreasure)?.prop ?? null)
function shuffle(){if(active.value||moving.value)return;training.value=shuffleTraining(training.value,state.settings.cultivationRandom)}
watch(()=>[state.settings.cultivationRealm,state.settings.cultivationRandom] as const,([selected,random])=>{
  const next=createTraining(selected)
  training.value=random?shuffleTraining(next):next
},{immediate:true})
const statusLabel = computed(() => ({ ready:'已同步',stale:'数据待更新',expired:'请重新登录',resetting:'同步今日额度',unavailable:'额度暂不可用',forbidden:'暂无访问权限','signed-out':'等待连接',connecting:'等待登录' }[state.status]))
const current = computed(() => actions.find(a => a.id === play.value.action))
const speech = computed(() => ({ idle: levels[level.value].speech, greet:'道友辛苦了，一起慢慢修行。',tea:'好茶！烦恼随茶汽散了。',woodfish:'心静 +1，功德在心不在卷。',talisman:play.value.completedAt !== null ? '三印已成，愿道友诸事顺遂。' : '天、地、人，依次结印。',comb:play.value.completedAt !== null ? '发丝顺了，心也顺了。' : '沿着头发，轻轻梳一梳。',incense:'一缕清香，且把杂念放下。',peach:'仙桃真甜，今日也有小欢喜。' }[play.value.action]))
let timer: ReturnType<typeof setInterval> | undefined
let lastTick=performance.now()
let stroke: { id: number; host: HTMLElement; x: number; y: number } | null = null
function releaseStroke() { const old = stroke; stroke = null; if (old?.host.hasPointerCapture(old.id)) old.host.releasePointerCapture(old.id) }
function focusWidget() { void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function act(action: CultivationAction) { releaseStroke(); panel.value = null; notice.value = ''; play.value = beginCultivation(action, performance.now()); focusWidget() }
function cancel() { releaseStroke(); play.value = cultivationIdle(); focusWidget() }
function escape() { panel.value = null; notice.value = ''; training.value={...training.value,encounter:null,encounterRemaining:26000}; cancel() }
function togglePanel(value: NonNullable<typeof panel.value>) { releaseStroke(); panel.value = panel.value === value ? null : value; if (!panel.value) focusWidget() }
function closePanel() { panel.value = null; focusWidget() }
function seal(index: number) { play.value = lightSeal(play.value, index, performance.now()) }
function keyboardComb() { play.value = combStroke(play.value, .24, performance.now()) }
function startComb(event: PointerEvent) { if (event.button !== 0 || play.value.action !== 'comb' || play.value.completedAt !== null) return; releaseStroke(); const host = event.currentTarget as HTMLElement; stroke = { id:event.pointerId, host, x:event.clientX, y:event.clientY }; host.setPointerCapture(event.pointerId); event.preventDefault() }
function dragComb(event: PointerEvent) {
  if (!stroke || stroke.id !== event.pointerId) return
  const rect = stroke.host.getBoundingClientRect(), x = event.clientX, y = event.clientY
  const inside = (px:number,py:number) => px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom
  if (inside(x,y) && inside(stroke.x,stroke.y)) play.value = combStroke(play.value, Math.hypot(x-stroke.x,y-stroke.y)/rect.width, performance.now())
  stroke.x=x; stroke.y=y
  if (play.value.completedAt !== null) releaseStroke()
}
async function safe(operation: () => Promise<unknown>, message: string) { try { await operation() } catch { notice.value = message } }
function setting(patch: Partial<Settings>) { void safe(() => api.settings(patch), '设置暂未保存，请重试') }
function login() { void safe(async () => { await api.login(); if (!isDesktop) notice.value = '请在桌面客户端完成官方登录' }, '登录窗口未能打开，请重试') }
function hide() { void safe(async () => { await api.hide(); if (!isDesktop) notice.value = '桌面版可收起到系统托盘' }, '收起失败，请重试') }
function demo(value: number) { if (!isDesktop) { previewQuota(value); cancel() } }
function visibility() { lastTick=performance.now(); visible.value = !document.hidden; if (!visible.value) { releaseStroke(); play.value = cultivationIdle() } }
onMounted(() => { timer=setInterval(() => {
  const now=performance.now(),delta=now-lastTick;lastTick=now
  if(visible.value) play.value=advanceCultivation(play.value,now)
  ambience.value=advanceAmbience(ambience.value,delta,{paused:!visible.value||!!panel.value||moving.value,reduced:state.settings.reducedMotion,active:active.value,realm:realm.value,practice:training.value.practice,encounter:training.value.encounter})
  training.value=advanceTraining(training.value,delta,{paused:!visible.value||active.value||!!panel.value||moving.value,random:state.settings.cultivationRandom,reduced:state.settings.reducedMotion})
},1000/30); document.addEventListener('visibilitychange',visibility); window.addEventListener('blur',releaseStroke) })
onUnmounted(() => { clearInterval(timer); releaseStroke(); document.removeEventListener('visibilitychange',visibility); window.removeEventListener('blur',releaseStroke) })
</script>
<template>
  <div class="cultivation-experience" :class="{ 'cultivation-native': isDesktop }">
    <div class="cultivation-hero">
      <section ref="widget" tabindex="-1" class="cultivation-widget" :class="['realm-' + realm, 'level-' + level, 'action-' + play.action, 'training-' + training.practice, event ? 'event-'+event.kind+' event-'+encounterPhase(event) : '', { 'is-training': trainingActive, 'has-panel': panel, 'has-action': active, 'has-encounter': !!event, 'has-notice': notice, 'is-moving': moving, 'is-paused': !visible || !!panel || moving }]" :style="encounterStyle" aria-label="修仙渡劫事务所场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
        <div class="cultivation-aura" aria-hidden="true"><div class="cultivation-ring"><i v-for="(rune,i) in ['乾','坤','震','巽','坎','离','艮','兑']" :key="rune" :style="{ transform: `rotate(${i*45}deg) translateY(-23cqw) rotate(${-i*45}deg)` }">{{ rune }}</i></div><span>✧</span></div>
        <Transition name="realm-dissolve">
          <div :key="realm" class="cultivation-realm-layer" :class="'scenery-'+realm" aria-hidden="true">
            <div class="cultivation-weather" :class="'weather-'+realm"><i v-for="i in 14" :key="i" :style="{ left: `${12+i*5.5}%`, top: `${8+(i%4)*11}%`, animationDelay: `${-i*.37}s` }"></i></div>
            <CultivationMaterial class="cultivation-island" atlas="islands" :index="islandForRealm(realm)"/>
            <CultivationProp v-if="realm === 'rain'" class="cultivation-umbrella" :index="8"/>
          </div>
        </Transition>
        <div class="cultivation-contact-shadow" aria-hidden="true"></div>
        <div class="cultivation-ground-mist" aria-hidden="true"></div>
        <div class="cultivation-actor" :class="'pose-'+actorFrame">
          <div v-if="event?.kind==='furnace-pop'" class="cultivation-soot" aria-hidden="true"><i></i><i></i><i></i></div>
          <CultivatorMotion :frame="actorFrame" :skin="state.settings.cultivationSkin" :running="motionRunning" :gentle="gentle"/>
          <CultivationMaterial v-if="accessory!==null" class="cultivation-worn-accessory" :class="'accessory-'+state.settings.cultivationAccessory" :index="accessory"/>
          <CultivationMaterial v-if="treasure!==null" class="cultivation-worn-treasure" :index="treasure"/>
          <CultivationProp v-if="current && ['tea','comb','peach'].includes(play.action)" :key="play.action" class="cultivation-held-prop" :class="'held-'+play.action" :index="current.prop"/>
          <div v-if="play.action==='tea'" class="cultivation-tea-steam" aria-hidden="true"><i></i><i></i></div>
          <button class="cultivation-pet-hit scene-hit" aria-label="轻点小仙人问安" @click="act('greet')"></button>
          <div v-if="play.action === 'comb' && play.completedAt === null" class="cultivation-hair-hit" data-pet-gesture aria-label="拖动梳头区域" @pointerdown="startComb" @pointermove="dragComb" @pointerup="releaseStroke" @pointercancel="releaseStroke" @lostpointercapture="releaseStroke"><span>轻轻拖动梳头</span></div>
        </div>
        <Transition name="practice-dissolve" mode="out-in">
          <CultivationTraining :key="training.practice" :class="{'training-suspended':!trainingActive && !trainingBackdrop,'training-background':trainingBackdrop}" :practice="training.practice" :level="level" :quiet="state.settings.reducedMotion"/>
        </Transition>
        <CultivationEncounter v-if="event" :key="training.encounterSequence" :event="event" :quiet="state.settings.reducedMotion" @dismiss="dismissEncounter"/>
        <span class="cultivation-crane-shadow" :style="{opacity:Math.max(.05,.28+ambience.crane.y/130),transform:`translateX(${ambience.crane.x*Math.max(0,1+ambience.crane.y/6)}cqw)`}" aria-hidden="true"></span>
        <button class="cultivation-crane scene-hit" :class="{'crane-airborne':ambience.crane.y < -6}" :style="{transform:`translate(${ambience.crane.x}cqw,${ambience.crane.y}cqw)`}" aria-label="向仙鹤问安" @click="act('greet')"><CultivationCrane :pose="ambience.crane"/></button>
        <button class="cultivation-burner scene-hit" :class="{'burner-hidden':!incenseVisible}" :disabled="!incenseVisible" aria-label="点一炉清香" @click="act('incense')"><CultivationIncense :lit="play.action==='incense'"/></button>
        <CultivationProp v-if="current && !['tea','comb','peach','incense'].includes(play.action)" :key="play.action" class="cultivation-action-prop" :class="'prop-' + play.action" :index="current.prop"/>
        <PhHeart v-if="play.action === 'greet' || play.action === 'peach'" class="cultivation-heart" weight="fill"/>
        <div v-if="play.action==='woodfish'" class="cultivation-sound-rings" aria-hidden="true"><i></i><i></i><span>静</span></div>
        <div v-if="play.action==='talisman'" class="cultivation-world-seals" aria-hidden="true"><span v-for="(rune,i) in ['天','地','人']" :key="rune" :class="{lit:play.progress>i}">{{rune}}</span></div>
        <p v-if="!active && !event" class="cultivation-speech">{{ level === 'full' || level === 'settling' ? practice.hint : speech }}</p>
        <button class="cultivation-quota" :aria-expanded="panel === 'details'" :aria-label="'今日剩余额度 ' + (percent === null ? '未知' : Math.round(percent) + '%')" @click="togglePanel('details')"><span>今日灵力 <small>· 额度</small></span><strong>{{ percent === null ? '—' : Math.round(percent) }}<small v-if="percent !== null">%</small></strong><span class="cultivation-meter"><i :style="{ width: `${Math.max(0,Math.min(100,percent ?? 0))}%` }"></i></span><small>{{ usable && state.quota ? `¥${state.quota.remaining.toFixed(2)} / ¥${state.quota.limit.toFixed(2)}` : statusLabel }}</small><em v-if="state.status === 'stale'">数据待更新</em></button>
        <span class="cultivation-motto" aria-hidden="true">修为有限<br/>热爱无边<span>仙</span></span>
        <header class="cultivation-header cultivation-chrome"><b><PhSparkle/>修仙渡劫事务所</b><div><button aria-label="更多修仙互动" :aria-expanded="panel === 'play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="切换修仙仙境" :aria-expanded="panel === 'realm'" @click="togglePanel('realm')"><PhMountains/></button><button aria-label="修仙百宝衣橱" :aria-expanded="panel === 'wardrobe'" @click="togglePanel('wardrobe')"><PhTShirt/></button><button aria-label="修仙设置" @click="emit('settings')"><PhGearSix/></button><button aria-label="收起仙人到托盘" @click="hide"><PhMinus/></button></div></header>
        <nav class="cultivation-tools cultivation-chrome" aria-label="陪仙人玩"><button v-for="item in actions" :key="item.id" :aria-label="item.label" @click="act(item.id)"><CultivationProp :index="item.prop"/><span>{{ item.label }}</span></button></nav>
        <footer class="cultivation-footer cultivation-chrome"><button :disabled="active" aria-label="换一段修炼机缘" @click="shuffle"><PhShuffle/><span>{{practice.label}}</span></button><button @click="togglePanel('details')"><PhInfo/>{{ statusLabel }}</button><button aria-label="刷新修仙额度" :disabled="state.syncing || !state.quota" @click="safe(() => api.refresh(), '刷新失败，请稍后重试')"><PhArrowsClockwise :class="{spin:state.syncing}"/></button><button v-if="!usable" :disabled="state.loginOpen" @click="login">{{ state.loginOpen ? '等待登录' : '连接账户' }}</button></footer>
        <div v-if="active" class="cultivation-hud" aria-live="polite"><div><b>{{ play.completedAt !== null ? '修行小事，圆满完成' : current?.label ?? '道友，见面好' }}</b><small>{{ speech }}</small><template v-if="play.action === 'comb'"><progress :value="play.progress" max="1.2" aria-label="梳发进度"></progress><button v-if="play.completedAt === null" @click="keyboardComb">梳一下</button></template><div v-if="play.action === 'talisman'" class="cultivation-seals"><button v-for="(rune,i) in ['天','地','人']" :key="rune" :aria-label="'点亮' + rune + '印'" :aria-pressed="play.progress > i" :disabled="play.completedAt !== null" @click="seal(i)">{{ rune }}<span>{{ play.progress > i ? '✓' : i+1 }}</span></button></div></div><button aria-label="结束修仙互动" @click="cancel">结束<PhX/></button></div>
        <section v-if="panel" class="cultivation-panel" role="dialog" :aria-label="panel === 'play' ? '修仙玩法' : panel === 'realm' ? '修仙仙境' : panel === 'wardrobe' ? '修仙百宝衣橱' : '修仙额度详情'"><header><b>{{ panel === 'play' ? '忙里偷闲，也算修行' : panel === 'realm' ? '今日，在哪一方仙境？' : panel === 'wardrobe' ? '仙衣百宝，随心装扮' : '今日额度账簿' }}</b><button aria-label="关闭修仙面板" @click="closePanel"><PhX/></button></header><template v-if="panel === 'play'"><div class="cultivation-play-grid"><button v-for="item in actions" :key="item.id" @click="act(item.id)"><CultivationProp :index="item.prop"/><b>{{ item.label }}</b><small>{{ item.hint }}</small></button><button @click="act('greet')"><PhHeart/><b>向道友问安</b></button></div><p>互动仅是本地陪伴，不消耗或恢复真实额度。</p></template><template v-else-if="panel === 'realm'"><CultivationRealmPicker :current-realm="realm" can-shuffle @shuffle="shuffle"/><p>随机只改变仙境和功法，衣装与额度各自保留。</p></template><template v-else-if="panel === 'wardrobe'"><CultivationWardrobe/></template><template v-else><p>{{ statusLabel }} · {{ state.message }}</p><dl v-if="state.quota"><div><dt>{{ usable ? '今日剩余' : '上次记录' }}</dt><dd>¥{{ state.quota.remaining.toFixed(2) }}</dd></div><div><dt>每日上限</dt><dd>¥{{ state.quota.limit.toFixed(2) }}</dd></div><div><dt>费用日期</dt><dd>{{ state.quota.day }}</dd></div><div><dt>费用更新时间</dt><dd>{{ state.quota.estimatedAt.replace('T',' ').slice(0,19) }}</dd></div></dl><p>北京时间每日 00:00 重置，以平台同步结果为准。</p><button @click="safe(() => api.openPortal(), '平台页面未能打开')">在平台查看 ↗</button></template></section>
        <p v-if="notice" class="cultivation-notice" role="status">{{ notice }}<button aria-label="关闭修仙提示" @click="notice='' "><PhX/></button></p>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="cultivation-resize" :class="corner" :aria-label="`缩放修仙 ${corner}`" @pointerdown.stop="down($event,corner)" @pointermove="move" @keydown.up.prevent="setting({windowWidth:state.settings.windowWidth+10})" @keydown.down.prevent="setting({windowWidth:state.settings.windowWidth-10})"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="cultivation-intro"><span class="cultivation-eyebrow">浮 生 半 日 · 云 上 修 行</span><h1>修仙渡劫<span>事务所</span><i>一念专注，一点仙气。</i></h1><p>每一次调用，都是一缕灵力。<br/>道友，且用且珍惜，也别忘了歇口气。</p><div class="cultivation-verse">“修为有限，热爱无边。”<span>与 AI 同行，共赴下一次天劫。</span></div><div class="cultivation-preview-actions"><button @click="act('tea')"><CultivationProp :index="3"/>请道友喝杯茶</button><button @click="setting({theme:night?'day':'night'})"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '切换白天' : '看看夜晚' }}</button></div><div class="cultivation-event-preview"><span>修炼奇遇 · 随功法随机发生</span><button v-for="encounter in ENCOUNTERS" :key="encounter.id" :aria-label="'预览'+encounter.label" @click="previewEncounter(encounter.id)">{{encounter.label}}</button></div><small>浏览器演示数据 · 互动不改变真实额度</small></aside>
    </div>
    <template v-if="!isDesktop"><section class="cultivation-preview-section"><header><span>壹 / 灵力起落</span><h2>今日道行，几分火候？</h2><small>点击切换演示额度</small></header><div class="cultivation-states"><button v-for="value in [100,50,20,15]" :key="value" :aria-label="`预览修仙${value}%额度`" :aria-pressed="percent === value" @click="demo(value)"><div :class="'sample-' + cultivationLevel(value)"><span class="sample-aura"></span><CultivatorSprite :frame="levels[cultivationLevel(value)].frame" :skin="state.settings.cultivationSkin"/><strong>{{ value }}<small>%</small></strong></div><b>{{ levels[cultivationLevel(value)].label }}</b><small>{{ levels[cultivationLevel(value)].speech }}</small></button></div></section><section class="cultivation-preview-section"><header><span>贰 / 修行小事</span><h2>忙里偷闲，亦是修行。</h2><small>一盏茶，一点陪伴</small></header><div class="cultivation-interactions"><button v-for="item in actions" :key="item.id" @click="act(item.id)"><CultivationProp :index="item.prop"/><b>{{ item.label }}</b><small>{{ item.hint }}</small></button></div></section><section class="cultivation-preview-section"><header><span>叁 / 四境随心</span><h2>心之所向，皆是仙境。</h2></header><CultivationRealmPicker :current-realm="realm" can-shuffle @shuffle="shuffle"/></section><section class="cultivation-preview-section"><header><span>肆 / 四时修行</span><h2>剑起云间，丹暖炉中。</h2><small>日常随机演出 · 手动互动优先</small></header><div class="cultivation-practices"><article v-for="item in PRACTICES" :key="item.id" :class="{'is-current':training.practice===item.id}"><CultivationMaterial :index="item.prop"/><b>{{item.label}}</b><small>{{item.hint}}</small></article></div></section><section class="cultivation-preview-section"><header><span>伍 / 仙衣百宝</span><h2>换一身风骨，赴一场仙缘。</h2><small>衣装、发饰、随身物独立保存</small></header><CultivationWardrobe/></section></template>
  </div>
</template>
