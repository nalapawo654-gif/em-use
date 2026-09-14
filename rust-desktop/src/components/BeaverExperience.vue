<script setup lang="ts">
import PetNotices from './PetNotices.vue'
import { provideCharacterMail } from '../shared/characterMail'
import { computed, nextTick, ref, watch } from 'vue'
import { PhTree, PhGearSix, PhMinus, PhGameController, PhTShirt, PhX, PhInfo, PhArrowsClockwise, PhCamera, PhHandHeart, PhChatCircleDots, PhTent, PhSignpost, PhShareNetwork, PhSun, PhMoon, PhArrowUpLeft } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import type { Settings } from '../shared/types'
import { BEAVER_STATES, BEAVER_MOTTOS, beaverLevel, beaverReply, type BeaverAction } from '../beaver/play'
import type { BeaverProp } from '../beaver/sprites'
import BeaverScene from './BeaverScene.vue'
import BeaverVisual from './BeaverVisual.vue'
import BeaverSprite from './BeaverSprite.vue'
import BeaverSkinPicker from './BeaverSkinPicker.vue'
provideCharacterMail('beaver')
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const scene = ref<InstanceType<typeof BeaverScene>>(), widget = ref<HTMLElement>()
const panel = ref<'play' | 'wardrobe' | 'details' | 'chat' | 'motto' | null>(null)
const chatInput = ref<HTMLInputElement>()
const notice = ref(''), capturing = ref(false), message = ref(''), reply = ref('今天的心情怎么样？和我说一句吧。')
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const interactions: { action: BeaverAction; label: string; prop: BeaverProp; hint: string }[] = [
  { action: 'groom', label: '梳毛', prop: 'brush', hint: '顺一顺毛，也顺一顺心情' },
  { action: 'feed', label: '喂面', prop: 'noodles', hint: '陪它吸溜一口热乎的' },
  { action: 'drink', label: '喝水', prop: 'water', hint: '咕嘟一口，慢慢歇口气' },
  { action: 'wood', label: '送木头', prop: 'logs', hint: '抱住新的小小收获' },
]
const extras: { action: BeaverAction; label: string; prop?: BeaverProp }[] = [
  { action: 'pet', label: '摸摸它' }, { action: 'ball', label: '丢球玩耍', prop: 'ball' }, { action: 'leaves', label: '收集树叶', prop: 'leaf' }, { action: 'bird', label: '小鸟来访', prop: 'bird' }, { action: 'rest', label: '歇一会儿' },
]
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '同步今日额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '等待登录' }[state.status]))
function toggle(value: NonNullable<typeof panel.value>) { panel.value = panel.value === value ? null : value; notice.value = '' }
function act(action: BeaverAction) { panel.value = null; notice.value = ''; scene.value?.act(action); void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function escape() { panel.value = null; scene.value?.cancel(); notice.value = ''; void nextTick(() => widget.value?.focus({ preventScroll: true })) }
function demo(percent: number) { if (isDesktop) return; previewQuota(percent); scene.value?.cancel() }
async function setting(patch: Partial<Settings>) { try { await api.settings(patch); notice.value = '' } catch { notice.value = '设置暂未保存，请重试' } }
async function login() { try { await api.login(); if (!isDesktop) notice.value = '请在桌面客户端完成官方登录' } catch { notice.value = '登录窗口未能打开，请重试' } }
async function refresh() { try { await api.refresh() } catch { notice.value = '刷新失败，请稍后重试' } }
async function photo(share = false) {
  if (capturing.value) return
  panel.value = null; notice.value = ''; capturing.value = true
  try {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    await nextTick(); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const path = await api.screenshot()
    notice.value = path ? (share ? '分享图已保存，可以发送给朋友啦' : '照片已保存') : isDesktop ? '' : '拍照与分享图保存请在桌面客户端使用'
  } catch { notice.value = '图片未能保存，请重试' } finally { capturing.value = false }
}
function chat() { const value = message.value.trim(); if (!value) return; reply.value = beaverReply(value); message.value = ''; void nextTick(() => chatInput.value?.focus()) }
watch(panel, (value, previous) => { if (!value && previous) void nextTick(() => widget.value?.focus({ preventScroll: true })) })
</script>
<template>
  <div class="beaver-experience" :class="{ 'beaver-native': isDesktop }">
    <div class="beaver-hero">
      <section ref="widget" tabindex="-1" class="beaver-widget" :class="{ 'has-panel': panel, 'is-moving': moving, 'is-capturing': capturing }" aria-label="林间海狸鼠场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="toggle('play')" @keydown.esc.stop="escape">
        <PetNotices :blocked="!!panel || moving || capturing || !!notice || !!scene?.updateBlocked" :message-blocked="!!panel || moving || capturing || !!notice" :message-deferred="!!scene?.updateBlocked"/>
        <BeaverScene ref="scene" :percent="percent" :remaining="usable ? state.quota?.remaining : undefined" :limit="usable ? state.quota?.limit : undefined" :skin="state.settings.beaverSkin" :night="night" :reduced-motion="state.settings.reducedMotion" :camp="state.settings.beaverCamp" :motto="state.settings.beaverMotto" :muted="['stale', 'expired', 'resetting'].includes(state.status)"/>
        <header class="beaver-header beaver-chrome"><span><PhTree weight="duotone"/><b>林间海狸鼠</b></span><div><button aria-label="更多海狸鼠互动" title="更多互动" :aria-expanded="panel === 'play'" @click="toggle('play')"><PhGameController/></button><button aria-label="海狸鼠换装" title="天气换装" :aria-expanded="panel === 'wardrobe'" @click="toggle('wardrobe')"><PhTShirt/></button><button aria-label="海狸鼠设置" title="设置" @click="emit('settings')"><PhGearSix/></button><button aria-label="收起海狸鼠到托盘" title="收起到托盘" @click="api.hide()"><PhMinus/></button></div></header>
        <nav class="beaver-tools beaver-chrome" aria-label="照顾海狸鼠"><button v-for="item in interactions" :key="item.action" :aria-label="`海狸鼠${item.label}`" :title="item.label" @click="act(item.action)"><BeaverSprite :prop="item.prop"/><span>{{ item.label }}</span></button><button aria-label="给海狸鼠拍照" title="拍照" :disabled="capturing" @click="photo()"><PhCamera/><span>拍照</span></button></nav>
        <footer class="beaver-footer beaver-chrome"><button :aria-expanded="panel === 'details'" @click="toggle('details')"><PhInfo/>{{ statusLabel }}</button><button aria-label="刷新海狸鼠额度" title="刷新额度" :disabled="state.syncing || !state.quota" @click="refresh"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button></footer>
        <button v-if="!usable" class="beaver-login beaver-chrome" :disabled="state.loginOpen" @click="login">{{ state.loginOpen ? '请在官方窗口完成登录' : '连接账户' }}</button>
        <section v-if="panel" class="beaver-panel" role="dialog" :aria-label="{ play: '海狸鼠游乐场', wardrobe: '海狸鼠衣橱', details: '海狸鼠额度详情', chat: '林间悄悄话', motto: '林间标语' }[panel]">
          <header><b>{{ { play: '忙里偷闲，陪它玩一会儿', wardrobe: '今天是什么天气心情？', details: '今日额度', chat: '林间悄悄话', motto: '给今天留一句话' }[panel] }}</b><button aria-label="关闭海狸鼠面板" @click="panel = null"><PhX/></button></header>
          <template v-if="panel === 'wardrobe'"><BeaverSkinPicker/><p class="beaver-panel-note">天气装扮随心选择，光线跟随公共昼夜设置。</p></template>
          <template v-else-if="panel === 'play'"><div class="beaver-extra-grid"><button v-for="item in interactions" :key="item.action" @click="act(item.action)"><BeaverSprite :prop="item.prop"/><span>{{ item.label }}</span></button><button v-for="item in extras" :key="item.action" @click="act(item.action)"><BeaverSprite v-if="item.prop" :prop="item.prop"/><PhHandHeart v-else-if="item.action === 'pet'"/><PhMoon v-else/><span>{{ item.label }}</span></button><button @click="panel = 'chat'"><PhChatCircleDots/><span>和它说话</span></button><button :aria-pressed="state.settings.beaverCamp" @click="setting({ beaverCamp: !state.settings.beaverCamp })"><PhTent/><span>{{ state.settings.beaverCamp ? '收起营地' : '布置营地' }}</span></button><button @click="panel = 'motto'"><PhSignpost/><span>更换标语</span></button><button :disabled="capturing" @click="photo(true)"><PhShareNetwork/><span>生成分享图</span></button></div><p class="beaver-panel-note">互动只是陪伴，不会消耗或恢复平台额度。</p></template>
          <template v-else-if="panel === 'details'"><p>{{ state.message }}</p><dl v-if="state.quota"><div><dt>每日额度</dt><dd>¥{{ state.quota.limit.toFixed(2) }}</dd></div><div><dt>今日剩余</dt><dd>¥{{ state.quota.remaining.toFixed(2) }}</dd></div><div><dt>费用更新</dt><dd>{{ state.quota.estimatedAt.replace('T', ' ').slice(0,19) }}</dd></div></dl><p class="beaver-panel-note">北京时间每日 00:00 重置，以平台同步结果为准。</p><button class="text-button" @click="api.openPortal()">在平台查看</button></template>
          <form v-else-if="panel === 'chat'" @submit.prevent="chat"><p class="beaver-reply" role="status">{{ reply }}</p><label>想说的话<input ref="chatInput" v-model="message" aria-label="给海狸鼠的话" maxlength="120" placeholder="今天有一点累……"/></label><button class="beaver-submit" :disabled="!message.trim()">说给它听</button><p class="beaver-panel-note">本机趣味对白，不发送消息到外部服务。</p></form>
          <div v-else class="beaver-motto-options"><button v-for="(text, key) in BEAVER_MOTTOS" :key="key" :aria-pressed="state.settings.beaverMotto === key" @click="setting({ beaverMotto: key }); panel = null">{{ text }}</button></div>
        </section>
        <p v-if="notice" class="beaver-notice" role="status">{{ notice }}<button aria-label="关闭海狸鼠提示" @click="notice = ''"><PhX/></button></p>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="beaver-resize" :class="corner" :aria-label="`缩放海狸鼠 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="setting({ windowWidth: state.settings.windowWidth + 10 })" @keydown.down.prevent="setting({ windowWidth: state.settings.windowWidth - 10 })"><PhArrowUpLeft/></button>
      </section>
      <aside v-if="!isDesktop" class="beaver-intro"><span class="beaver-eyebrow"><PhTree/> A LITTLE FOREST, A LITTLE COMPANY</span><h1>一口一口，<br/>啃出好点子。</h1><p>让这位林间小伙伴，陪你度过专注的日子。<br/>看看它的精神头，就知道今天还剩多少余量。</p><div class="beaver-intro-note"><BeaverSprite prop="leaf"/><span>少一点请求，多一点创意。<br/><b>一起守护这棵树。</b></span></div><div class="beaver-preview-actions"><button @click="act('pet')"><PhHandHeart/>摸摸它</button><button @click="setting({ theme: night ? 'day' : 'night' })"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '看看白天' : '看看夜晚' }}</button></div><small>桌面外观预览 · 演示额度 · 互动不改变真实额度</small></aside>
    </div>
    <template v-if="!isDesktop">
      <section class="beaver-preview-section"><header><h2>不同额度状态</h2><span>从元气满满，到安心收工</span><small>演示数据</small></header><div class="beaver-states"><button v-for="(item, index) in BEAVER_STATES" :key="item.percent" :aria-label="`预览海狸鼠额度 ${item.percent}%`" :aria-pressed="percent !== null && beaverLevel(percent) === index" :class="{ selected: percent !== null && beaverLevel(percent) === index }" @click="demo(item.percent)"><div><BeaverVisual :level="index" :skin="state.settings.beaverSkin" action="idle" :since="0" :reduced-motion="state.settings.reducedMotion"/><strong>{{ item.percent }}%</strong></div><b>{{ item.label }}</b><small>{{ item.hint }}</small></button></div></section>
      <div class="beaver-preview-bottom"><section class="beaver-preview-section"><header><h2>天气与换装</h2></header><BeaverSkinPicker/><p class="beaver-panel-note">晴雨雪风，换一种出门的心情。</p></section><section class="beaver-preview-section"><header><h2>互动玩法</h2></header><div class="beaver-demo-actions"><button v-for="item in interactions" :key="item.action" @click="act(item.action)"><BeaverSprite :prop="item.prop"/><b>{{ item.label }}</b><small>{{ item.hint }}</small></button><button @click="photo()"><PhCamera/><b>拍照</b><small>留住这一刻</small></button></div></section><section class="beaver-preview-section"><header><h2>林间小日常</h2></header><div class="beaver-mini-actions"><button @click="toggle('chat')"><PhChatCircleDots/>和它说话</button><button @click="act('leaves')"><BeaverSprite prop="leaf"/>收集树叶</button><button @click="act('ball')"><BeaverSprite prop="ball"/>丢球玩耍</button><button @click="act('bird')"><BeaverSprite prop="bird"/>小鸟来访</button><button @click="setting({ beaverCamp: !state.settings.beaverCamp })"><PhTent/>{{ state.settings.beaverCamp ? '收起营地' : '布置营地' }}</button><button @click="toggle('motto')"><PhSignpost/>更换标语</button><button @click="photo(true)"><PhShareNetwork/>生成分享图</button></div></section></div>
    </template>
  </div>
</template>
