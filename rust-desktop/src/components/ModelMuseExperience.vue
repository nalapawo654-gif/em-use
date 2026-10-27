<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhArrowUpLeft, PhArrowsClockwise, PhCamera, PhChatCircleDots, PhGameController, PhGearSix, PhHandWaving, PhMinus, PhSparkle, PhX } from '@phosphor-icons/vue'
import { api, quotaState as state, quotaDisplay, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import { evolution, systemReduced } from '../evolution/controller'
import { setEvolutionLoading } from '../evolution/readiness'
import PetEvolution from './PetEvolution.vue'
import type { Corner } from '../shared/windowGeometry'
import { modelForm, PERSONAS, type ModelForm } from '../modelmuse/personas'
import PetArcToolbar from './PetArcToolbar.vue'
import PetNotices from './PetNotices.vue'
import PetCalendar from './PetCalendar.vue'
import CodexQuotaReadout from './CodexQuotaReadout.vue'
import QuotaDetails from './QuotaDetails.vue'
import '../modelmuse.css'
const props = defineProps<{percent:number|null;night:boolean;usable:boolean}>()
const emit = defineEmits<{settings:[]}>()
const widget = ref<HTMLElement>(), panel = ref<'play'|'details'|null>(null), calendarOpen = ref(false), noticeOpen = ref(false), error = ref('')
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners:Corner[] = ['nw','ne','sw','se']
const target = computed(() => modelForm(props.percent)), displayed = ref<ModelForm|null>(target.value)
const action = ref<'hello'|'tidy'|'sign'|'idle'|null>(null), line = ref(''), assetFailed = ref(false), retry = ref(0), visible = ref(!document.hidden)
const still = computed(() => state.settings.reducedMotion || systemReduced.value || state.settings.evolutionMotion === 'off')
const blocked = computed(() => !!panel.value || calendarOpen.value || noticeOpen.value || moving.value || !!error.value || !!action.value)
const persona = computed(() => displayed.value ? PERSONAS[displayed.value] : null)
const awake = computed(() => evolution.awake && displayed.value !== null)
const asset = computed(() => {
  if (!displayed.value) return ''
  const animated = !still.value && evolution.phase !== 'idle'
  if (animated && evolution.phase === 'reveal' && awake.value) return `./assets/modelmuse/${displayed.value}-awake-reveal.png?v=${retry.value}`
  const gathering = animated && evolution.phase === 'gather'
  const dressing = animated && (evolution.phase === 'unfold' || evolution.phase === 'return' && awake.value)
  const costume = gathering ? '' : awake.value ? '-awake' : ''
  const pose = gathering || dressing || action.value === 'tidy' ? '-tidy' : ''
  return `./assets/modelmuse/${displayed.value}${costume}${pose}.png?v=${retry.value}`
})
// Warm all poses for the current form so interactions do not flash a blank image.
watch([displayed, retry], ([form, version]) => {
  if (!form) return
  for (const suffix of ['', '-tidy', '-awake', '-awake-tidy', '-awake-reveal']) {
    const image = new Image(); image.src = `./assets/modelmuse/${form}${suffix}.png?v=${version}`
  }
}, { immediate: true })
const loadingOwner = Symbol('modelmuse-art')
watch([target, () => state.settings.quotaSource, retry], ([form, source, version], _, onCleanup) => {
  if (!form || source !== 'codex') { setEvolutionLoading(loadingOwner, false); return }
  let canceled = false, pending = 3
  const images = ['-awake', '-awake-tidy', '-awake-reveal'].map(suffix => {
    const img = new Image()
    img.onload = img.onerror = () => { if (!canceled && --pending === 0) setEvolutionLoading(loadingOwner, false) }
    img.src = `./assets/modelmuse/${form}${suffix}.png?v=${version}`
    return img
  })
  setEvolutionLoading(loadingOwner, true)
  onCleanup(() => { canceled = true; for (const img of images) img.onload = img.onerror = null; setEvolutionLoading(loadingOwner, false) })
}, { immediate: true })
const status = computed(() => ({ready:'已同步',stale:'数据待更新',expired:'请重新连接','signed-out':'等待连接',connecting:'正在连接',unavailable:'暂不可用',forbidden:'暂无权限',resetting:'正在同步'}[state.status]))
const defaultLine = computed(() => !persona.value ? '额度还没同步，先等等我。' : props.percent === 0 ? '额度已用完，等同步后再出发。' : persona.value.idle[0])
let actionTimer:ReturnType<typeof setTimeout>|undefined, idleTimer:ReturnType<typeof setInterval>|undefined, lastLine = -1, lastIdle = Date.now()
function choose(lines:string[]) { let i = Math.floor(Math.random()*lines.length); if (lines.length>1 && i===lastLine) i=(i+1)%lines.length; lastLine=i; return lines[i]! }
function finish(){clearTimeout(actionTimer);action.value=null;line.value='';lastIdle=Date.now()}
function act(kind:'hello'|'tidy'|'sign'|'idle') {
  if (calendarOpen.value || noticeOpen.value) return
  finish(); panel.value=null; action.value=kind; line.value=persona.value ? choose(persona.value[kind]) : '额度还没同步，先等等我。'; actionTimer=setTimeout(finish,kind==='sign'?4500:3000)
}
function togglePanel(value:'play'|'details'){finish();error.value='';panel.value=panel.value===value?null:value}
function closePanel(){panel.value=null;void nextTick(()=>widget.value?.focus({preventScroll:true}))}
function escape(){panel.value=null;error.value='';finish()}
async function run(fn:()=>Promise<unknown>,message:string){try{await fn()}catch{error.value=message}}
async function screenshot(){finish();panel.value=null;try{const path=await api.screenshot();if(!path&&!isDesktop)error.value='截图保存请在桌面版使用。'}catch{error.value='截图未能保存，请重试。'}}
function openSettings(){escape();emit('settings')}
async function demoSource(){ if(isDesktop)return; await api.settings({quotaSource:state.settings.quotaSource==='codex'?'eastmoney':'codex',codexEnabled:true}); previewQuota(props.percent ?? 68) }
watch([target,blocked],([next,busy])=>{if (next===null && displayed.value!==null && action.value) finish(); if (!busy || next===null){if(next!==displayed.value){displayed.value=next;assetFailed.value=false}}},{immediate:true})
function visibility(){visible.value=!document.hidden;if(!visible.value)finish()}
onMounted(()=>{document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',finish);idleTimer=setInterval(()=>{if(visible.value&&!blocked.value&&!still.value&&persona.value&&Date.now()-lastIdle>30000){lastIdle=Date.now();act('idle')}},2000)})
onUnmounted(()=>{finish();setEvolutionLoading(loadingOwner,false);clearInterval(idleTimer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',finish)})
</script>
<template>
<div class="muse-experience" :class="{'muse-native':isDesktop}"><div class="muse-layout">
<section ref="widget" tabindex="-1" class="muse-widget pet-arc-host" :class="[{ 'has-panel':panel,'has-action':action,'is-moving':moving,'calendar-is-open':calendarOpen,'muse-notice-open':noticeOpen,'muse-still':still }, displayed ? 'form-'+displayed : 'form-unknown']" :style="{'--muse-accent':persona?.accent ?? '#857e86'}" aria-label="额度变装小人" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" @keydown.esc.stop.prevent="escape">
  <PetEvolution :blocked="blocked"/>
  <PetNotices :blocked="!!panel||moving||!!error||!!action" :message-blocked="!!panel||moving||!!error" :message-deferred="!!action" :external-blocked="calendarOpen" :external-deferred="!!state.calendar?.active.length" @open-change="noticeOpen=$event"/>
  <PetCalendar appearance="modelmuse" :blocked="!!panel||moving||!!error||noticeOpen||!!action" @open-change="calendarOpen=$event"/>
  <div class="muse-character" :class="action ? 'action-'+action : ''" aria-hidden="true">
    <Transition name="muse-change" mode="out-in"><img v-if="asset&&!assetFailed" :key="displayed || 'unknown'" :src="asset" alt="" @error="assetFailed=true"/><div v-else-if="!asset" key="unknown" class="muse-unknown"><span>?</span><small>等待额度</small></div></Transition>
  </div>
  <button class="muse-hit scene-hit" :disabled="!!panel||calendarOpen||noticeOpen||!!error" :aria-label="`向${persona?.name ?? '小人'}打招呼`" @click="act('hello')"/>
  <div v-if="assetFailed" class="muse-error" role="status" data-pet-gesture>角色素材未加载 <button @click="retry++;assetFailed=false">重试</button></div>
  <div v-else-if="error" class="muse-error" role="status" data-pet-gesture>{{error}} <button aria-label="关闭提示" @click="error=''">×</button></div>
  <p class="muse-speech" aria-live="polite">{{line||defaultLine}}</p>
  <button class="muse-quota" :disabled="noticeOpen||calendarOpen" aria-label="查看额度详情" :aria-expanded="panel==='details'" @click="togglePanel('details')"><CodexQuotaReadout compact><span>{{quotaDisplay.label}}</span><strong>{{percent===null?'—':Math.round(percent)+'%'}}</strong><small>{{status}}</small></CodexQuotaReadout></button>
  <PetArcToolbar scene="modelmuse" label="额度变装小人" :blocked="calendarOpen||noticeOpen"><template #controls><button aria-label="更多玩法" :aria-expanded="panel==='play'" @click="togglePanel('play')"><PhGameController/></button><button aria-label="查看额度详情" :aria-expanded="panel==='details'" @click="togglePanel('details')"><PhSparkle/></button><button aria-label="设置" @click="openSettings"><PhGearSix/></button><button aria-label="收起到托盘" @click="run(()=>api.hide(),'收起失败，请重试。')"><PhMinus/></button></template><button aria-label="打招呼" :disabled="!persona" @click="act('hello')"><PhHandWaving/><span>打招呼</span></button><button aria-label="整理行头" :disabled="!persona" @click="act('tidy')"><PhSparkle/><span>整理</span></button><button aria-label="抽一句状态签" :disabled="!persona" @click="act('sign')"><PhChatCircleDots/><span>抽签</span></button></PetArcToolbar>
  <section v-if="panel" class="muse-panel" data-pet-gesture role="dialog" :aria-label="panel==='play'?'变装小人玩法':'额度详情'"><header><b>{{panel==='play'?'陪小人玩一会儿':'额度详情'}}</b><button aria-label="关闭面板" @click="closePanel"><PhX/></button></header><div v-if="panel==='play'" class="muse-options"><button :disabled="!persona" @click="act('hello')"><PhHandWaving/>打招呼</button><button :disabled="!persona" @click="act('tidy')"><PhSparkle/>整理行头</button><button :disabled="!persona" @click="act('sign')"><PhChatCircleDots/>抽一句状态签</button><button @click="screenshot"><PhCamera/>拍张变装照</button><p>互动只改变小人的表情和动作，不改变真实额度。</p></div><QuotaDetails v-else/></section>
  <footer class="muse-status"><span>{{status}}</span><button :disabled="state.syncing||!quotaDisplay.canRefresh" aria-label="刷新额度" @click="run(()=>api.refresh(),'刷新失败，请重试。')"><PhArrowsClockwise/></button><button v-if="!usable" @click="run(()=>api.login(),'连接窗口未能打开。')">连接账户</button></footer>
  <button v-for="corner in (isDesktop?corners:[])" :key="corner" class="muse-resize" :class="corner" :aria-label="`缩放桌宠 ${corner}`" @pointerdown.stop="down($event,corner)" @pointermove="move" @keydown.up.prevent="run(()=>api.settings({windowWidth:state.settings.windowWidth+10}),'大小未能保存。')" @keydown.down.prevent="run(()=>api.settings({windowWidth:state.settings.windowWidth-10}),'大小未能保存。')"><PhArrowUpLeft/></button>
</section>
<aside v-if="!isDesktop" class="muse-intro"><span>THE LITTLE MODEL MUSE</span><h1>额度有变化，<br/><em>小人也变装。</em></h1><p>从大小姐到小迷糊，<br/>陪你一起见证今天的灵感余额。</p><div><button v-for="item in [{v:100,n:'Claude'}, {v:80,n:'GPT'}, {v:60,n:'Gemini'}, {v:40,n:'豆包'}]" :key="item.v" @click="previewQuota(item.v)">{{item.n}} · {{item.v}}%</button></div><button class="muse-source-demo" @click="demoSource">{{state.settings.quotaSource==='codex'?'预览 AI 云平台':'预览 Codex 觉醒'}}</button><small>仅为浏览器演示数据，角色名称不代表实际切换模型。</small></aside>
</div></div>
</template>
