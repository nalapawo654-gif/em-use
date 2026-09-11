<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PhGearSix, PhMinus, PhArrowsClockwise, PhFish, PhDrop, PhCamera, PhSun, PhMoon, PhArrowRight, PhCheckCircle, PhCloudSlash, PhArrowSquareOut, PhPlant, PhSparkle, PhInfo, PhHeart, PhShieldCheck, PhGameController, PhTreasureChest, PhEye, PhX } from '@phosphor-icons/vue'
import Aquarium from './components/Aquarium.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import OutfitPicker from './components/OutfitPicker.vue'
import BuddyExperience from './components/BuddyExperience.vue'
import BeaverExperience from './components/BeaverExperience.vue'
import CultivationExperience from './components/CultivationExperience.vue'
import HamsterExperience from './components/HamsterExperience.vue'
import { SCENE_LABELS } from './shared/types'
import ScenePicker from './components/ScenePicker.vue'
import { api, appState as state, isDesktop, previewQuota } from './bridge'
import { useWindowGestures } from './windowGestures'
import type { Corner } from './shared/windowGeometry'
import { money, moodFor } from './shared/quota'
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const effectiveSize = computed(() => state.settings.windowWidth < 250 ? 'mini' : state.settings.windowWidth < 360 ? 'compact' : 'standard')
const view = new URLSearchParams(location.search).get('view')
const showSettings = ref(view === 'settings'), details = ref(false), toast = ref('')
const playPanel = ref<'outfit' | 'play' | null>(null)
const aquarium = ref<InstanceType<typeof Aquarium> | null>(null)
const now = ref(Date.now())
const timeTimer = setInterval(() => now.value = Date.now(), 30_000)
let toastTimer: ReturnType<typeof setTimeout>
const connected = computed(() => !!state.quota && !['signed-out', 'expired', 'connecting'].includes(state.status))
const usable = computed(() => connected.value && !['unavailable', 'forbidden', 'resetting'].includes(state.status))
const percent = computed(() => usable.value ? state.quota!.percent : null)
const mood = computed(() => moodFor(percent.value ?? 68))
const night = computed(() => state.settings.theme === 'night' || (state.settings.theme === 'auto' && (new Date(now.value).getHours() >= 19 || new Date(now.value).getHours() < 7)))
watch(() => state.settings.scene, scene => { document.title = `EM Use · ${SCENE_LABELS[scene]}` }, { immediate: true })
const stateLabel = computed(() => ({ 'signed-out': '等待连接', connecting: '等待登录', ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '同步今日额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限' }[state.status]))
const moodLabel = computed(() => ({ abundant: '充足', normal: '正常', warning: '留意额度', danger: '额度偏低' }[mood.value]))
const updated = computed(() => state.quota?.estimatedAt.slice(11, 16) ?? '—')
const greeting = computed(() => percent.value === null ? '小鱼已就位，就等你啦' : percent.value > 60 ? '水很清，今天也大有可为。' : percent.value > 30 ? '不急不忙，灵感慢慢来。' : percent.value > 10 ? '慢一点，给灵感留点余量。' : '歇一歇吧，明天又是满满能量。')
function notify(text: string) { toast.value = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.value = '', 3000) }
function interact(kind: string) {
  clearTimeout(toastTimer); toast.value = ''
  if (kind === 'love') notify('收到你的小心意啦')
}
async function login() { try { await api.login(); if (!isDesktop) notify('请运行桌面版完成官方登录；此页面可预览外观') } catch { notify('登录窗口未能打开，请重试') } }
async function refresh() { try { await api.refresh(); if (state.status === 'ready') notify('已获取平台最新结果') } catch { notify('刷新失败，请稍后重试') } }
async function screenshot() { try { const p = await api.screenshot(); if (p) notify('小鱼缸截图已保存'); else if (!isDesktop) notify('截图保存功能可在桌面版使用') } catch { notify('截图未能保存，请重试') } }
function togglePanel(panel: 'outfit' | 'play') { playPanel.value = playPanel.value === panel ? null : panel }
function playGame(game: 'feed' | 'clean' | 'hide' | 'treasure' | 'outfit' | 'screenshot') {
  if (game === 'outfit') { playPanel.value = 'outfit'; return }
  playPanel.value = null
  if (game === 'screenshot') void screenshot(); else aquarium.value?.[game]()
}
function openSettings() { if (isDesktop) void api.openSettings(); else showSettings.value = true }
function openPreviewSettings() { showSettings.value = true }
onMounted(() => { window.addEventListener('open-settings', openPreviewSettings); document.body.classList.toggle('native-window', isDesktop); if (!isDesktop) previewQuota(68) })
onUnmounted(() => { clearInterval(timeTimer); clearTimeout(toastTimer); window.removeEventListener('open-settings', openPreviewSettings) })
</script>

<template>
  <main @keydown.esc="playPanel = null" :class="['app', { native: isDesktop, night, 'buddy-app': state.settings.scene === 'buddy', 'beaver-app': state.settings.scene === 'beaver', 'hamster-app': state.settings.scene === 'hamster', 'cultivation-app': state.settings.scene === 'cultivation', 'settings-view': view === 'settings', 'reduced-motion': state.settings.reducedMotion }]">
    <template v-if="view === 'settings'"><SettingsPanel @close="api.hide()"/></template>
    <template v-else>
      <header v-if="!isDesktop" class="preview-header"><a class="brand" href="#"><PhFish weight="duotone"/><b>EM <span>Use</span></b></a><ScenePicker/><div class="preview-links"><span class="preview-label">桌面应用 · 外观预览</span><button @click="openSettings"><PhGearSix/>偏好设置</button></div></header>
      <BuddyExperience v-if="state.settings.scene === 'buddy'" :percent="percent" :night="night" :usable="usable" @settings="openSettings"/>
      <BeaverExperience v-else-if="state.settings.scene === 'beaver'" :percent="percent" :night="night" :usable="usable" @settings="openSettings"/>
      <HamsterExperience v-else-if="state.settings.scene === 'hamster'" :percent="percent" :night="night" :usable="usable" @settings="openSettings"/>
      <CultivationExperience v-else-if="state.settings.scene === 'cultivation'" :percent="percent" :night="night" :usable="usable" @settings="openSettings"/>
      <div v-else :class="['experience', { 'is-native': isDesktop }, isDesktop ? effectiveSize : 'standard']">
        <section @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="togglePanel('play')" class="widget" :class="{ 'has-details': details, 'has-panel': !!playPanel, 'is-moving': moving }" aria-label="额度小鱼缸">
          <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="resize-handle" :class="corner" :aria-label="`缩放鱼缸 ${corner}`" title="拖动调整大小 · Ctrl/⌘ + 滚轮也可以" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="api.settings({ windowWidth: state.settings.windowWidth + 10 })" @keydown.down.prevent="api.settings({ windowWidth: state.settings.windowWidth - 10 })"><span></span></button>
          <header class="widget-header"><div class="widget-title"><PhFish weight="duotone"/><span>额度小鱼缸</span><small v-if="!isDesktop">让监控变得有温度</small></div><div class="window-actions"><button class="icon-button mini-play-button" aria-label="玩耍" title="玩耍" @click="togglePanel('play')"><PhGameController/></button><button class="icon-button" title="设置" aria-label="设置" @click="openSettings"><PhGearSix/></button><button class="icon-button" title="收起到托盘" aria-label="收起到托盘" @click="api.hide()"><PhMinus/></button></div></header>
          <div class="widget-body">
            <div class="floating-note"><PhSparkle weight="fill"/><span>{{ state.status === 'resetting' ? '新的一天，正在补充能量' : '每天 00:00，能量重新出发' }}</span></div>
            <div class="aquarium-wrap">
              <Aquarium ref="aquarium" :percent="percent" :outfit="state.settings.outfit" :night="night" :reduced-motion="state.settings.reducedMotion" :compact="isDesktop && effectiveSize !== 'standard'" :muted="['stale', 'expired', 'resetting'].includes(state.status)" @interact="interact">
                <div v-if="usable && state.quota" class="inside-amount">¥{{ money(state.quota.remaining) }} <span>/ ¥{{ money(state.quota.limit) }}</span></div>
              </Aquarium>
            </div>
            <div class="interaction-tools"><button title="喂食" aria-label="喂食" @click="aquarium?.feed()"><PhFish weight="duotone"/><span>喂食</span></button><button title="清洁" aria-label="清洁" @click="aquarium?.clean()"><PhDrop weight="duotone"/><span>清洁</span></button><button title="换装" aria-label="换装" :aria-expanded="playPanel === 'outfit'" @click="togglePanel('outfit')"><PhPlant weight="duotone"/><span>换装</span></button><button title="玩耍" aria-label="玩耍" :aria-expanded="playPanel === 'play'" @click="togglePanel('play')"><PhGameController weight="duotone"/><span>玩耍</span></button></div>
            <button v-if="!connected" class="login-pill" :disabled="state.loginOpen" @click="login">{{ state.loginOpen ? '请在官方窗口完成登录' : state.status === 'expired' ? '重新登录，接上小鱼的信号' : '登录 AI 云平台' }}<PhArrowRight v-if="!state.loginOpen"/></button>
            <p class="fish-message">{{ greeting }} <PhHeart/></p>
          </div>
          <Transition name="play-panel"><section v-if="playPanel" class="play-popover" :class="playPanel" role="dialog" :aria-label="playPanel === 'outfit' ? '小鱼衣橱' : '小鱼游乐场'">
            <header><div><b>{{ playPanel === 'outfit' ? '今天，想做哪一只小鱼？' : '陪小鱼玩一会儿' }}</b><small>{{ playPanel === 'outfit' ? '装扮会保存在这台电脑上' : '点点宝箱，或者跟小鱼捉迷藏' }}</small></div><button class="icon-button" aria-label="关闭互动面板" @click="playPanel = null"><PhX/></button></header>
            <OutfitPicker v-if="playPanel === 'outfit'"/>
            <div v-else class="play-options"><button @click="playGame('treasure')"><PhTreasureChest weight="duotone"/><span>打开宝箱</span></button><button @click="playGame('hide')"><PhEye weight="duotone"/><span>躲猫猫</span></button><button @click="playGame('feed')"><PhFish weight="duotone"/><span>喂食</span></button><button @click="playGame('clean')"><PhDrop weight="duotone"/><span>擦鱼缸</span></button><button @click="playGame('outfit')"><PhPlant weight="duotone"/><span>换装</span></button><button @click="playGame('screenshot')"><PhCamera weight="duotone"/><span>截图</span></button></div>
          </section></Transition>
          <footer class="widget-footer"><button class="status-pill" @click="details = !details"><PhCheckCircle v-if="state.status === 'ready'" weight="fill"/><PhCloudSlash v-else-if="state.status === 'stale'"/><PhInfo v-else/><span>{{ stateLabel }}</span><small>{{ state.quota ? `${updated} 更新` : '官方安全登录' }}</small></button><button class="icon-button refresh-button" aria-label="刷新额度" :disabled="state.syncing || !connected" @click="refresh"><PhArrowsClockwise :class="{ spin: state.syncing }"/></button></footer>
          <div v-if="details" class="detail-popover"><b>今日额度详情</b><p>{{ state.message }}</p><template v-if="state.quota"><div><span>已用</span><strong>¥{{ money(state.quota.used) }}</strong></div><div><span>上限</span><strong>¥{{ money(state.quota.limit) }}</strong></div><div><span>费用更新时间</span><strong>{{ state.quota.estimatedAt.replace('T', ' ').slice(0, 19) }}</strong></div></template><small>北京时间每日 00:00 重置，费用可能延迟数分钟。</small><button class="text-button" @click="api.openPortal()">在平台查看<PhArrowSquareOut/></button></div>
          <Transition name="toast"><div v-if="toast" class="toast" role="status">{{ toast }}</div></Transition>
        </section>
        <aside v-if="!isDesktop" class="companion-panel">
          <span class="eyebrow"><span class="tiny-dot"></span>A LITTLE COMPANY, EVERY DAY</span>
          <h1>让每一份额度，<br/>都有一点<span>可爱。</span></h1>
          <p class="intro">看一眼水位，就知道还剩多少灵感。<br/>一方小小鱼缸，陪你度过专注的一天。</p>
          <div class="daily-summary"><div class="summary-label"><span>今日剩余</span><span class="mood-tag" :class="mood">{{ moodLabel }}</span></div><div class="summary-amount"><small>¥</small>{{ state.quota ? money(state.quota.remaining) : '—' }}<span>/ {{ state.quota ? money(state.quota.limit) : '—' }}</span></div><div class="quota-meter"><span :style="{ width: `${percent ?? 0}%` }"></span></div><div class="summary-meta"><span>每日 00:00 重置</span><span>北京时间</span></div></div>
          <div class="preview-controls"><div><b>看看小鱼的不同状态</b><small>仅用于外观预览 · 演示数据</small></div><div class="state-buttons"><button v-for="s in [{ value: 88, label: '充足', key: 'abundant' }, { value: 48, label: '正常', key: 'normal' }, { value: 22, label: '告警', key: 'warning' }, { value: 5, label: '危险', key: 'danger' }]" :key="s.value" :class="[s.key, { selected: mood === s.key }]" @click="previewQuota(s.value)"><i></i>{{ s.label }}</button></div></div>
          <div class="preview-bottom"><button @click="api.settings({ theme: night ? 'day' : 'night' })"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '切换白天' : '看看夜晚' }}</button><span>换装、躲猫猫，擦擦玻璃<PhArrowRight/></span></div>
        </aside>
      </div>
      <footer v-if="!isDesktop" class="preview-footer"><span><PhShieldCheck/>登录凭据保存在本机 · 额度由官方平台同步</span><span>EM Use v{{ state.version }} <i> / </i> Windows & macOS</span></footer>
      <div v-if="showSettings" class="modal-backdrop" @click.self="showSettings = false"><SettingsPanel @close="showSettings = false"/></div>
    </template>
  </main>
</template>
