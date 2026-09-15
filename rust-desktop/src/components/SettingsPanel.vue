<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { PhX, PhArrowSquareOut, PhSignOut, PhDesktop, PhSun, PhMoon, PhCircleHalf, PhFish, PhCheck, PhShieldCheck, PhDownloadSimple } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop } from '../bridge'
import type { Settings } from '../shared/types'
import MessageSettings from './MessageSettings.vue'
import CalendarSettings from './CalendarSettings.vue'
import OutfitPicker from './OutfitPicker.vue'
import ScenePicker from './ScenePicker.vue'
import BuddySkinPicker from './BuddySkinPicker.vue'
import BuddySprite from './BuddySprite.vue'
import BeaverSprite from './BeaverSprite.vue'
import BeaverSkinPicker from './BeaverSkinPicker.vue'
import CultivationWardrobe from './CultivationWardrobe.vue'
import CultivationRealmPicker from './CultivationRealmPicker.vue'
import CultivatorSprite from './CultivatorSprite.vue'
import LuckyCatVisual from './LuckyCatVisual.vue'
import LuckyCatWardrobe from './LuckyCatWardrobe.vue'
import { skadiSelectedSkin } from '../shared/types'
import SkadiArmory from './SkadiArmory.vue'
import SkadiVisual from './SkadiVisual.vue'
import SkadiWardrobe from './SkadiWardrobe.vue'
import FoxVisual from './FoxVisual.vue'
import FoxWardrobe from './FoxWardrobe.vue'
import DinosaurVisual from './DinosaurVisual.vue'
import DinosaurWardrobe from './DinosaurWardrobe.vue'
import FeiduduVisual from './FeiduduVisual.vue'
import FeiduduWardrobe from './FeiduduWardrobe.vue'
import BatteryWardrobe from './BatteryWardrobe.vue'
import BatteryVisual from './BatteryVisual.vue'
import HamsterVisual from './HamsterVisual.vue'
import HamsterSkinPicker from './HamsterSkinPicker.vue'
import { money } from '../shared/quota'
const emit = defineEmits<{ close: [] }>()
const tab = ref(['updates', 'messages', 'calendar'].includes(new URLSearchParams(location.search).get('tab') ?? '') ? new URLSearchParams(location.search).get('tab')! : 'appearance'), notice = ref('')
const openMessages = () => { tab.value = 'messages' }
onMounted(() => window.addEventListener('open-messages', openMessages))
onUnmounted(() => window.removeEventListener('open-messages', openMessages))
const openUpdates = () => { tab.value = 'updates' }
onMounted(() => window.addEventListener('open-updates', openUpdates))
onUnmounted(() => window.removeEventListener('open-updates', openUpdates))
const updateBusy = computed(() => ['checking', 'downloading', 'installing'].includes(state.update?.status ?? ''))
async function checkUpdate() { try { await api.checkUpdate?.() } catch { /* Native update state includes a readable error. */ } }
async function installUpdate() { try { await api.installUpdate?.() } catch { /* Native update state includes a readable error. */ } }
const connected = computed(() => !!state.quota && !['expired', 'signed-out'].includes(state.status))
const accountTitle = computed(() => connected.value ? (state.account?.name || (state.account?.id ? `账户 ${state.account.id}` : '已连接 AI 云平台')) : state.syncing ? '正在连接账户' : '还没有连接账户')
const loginDescription = computed(() => state.loginMode === 'dongdong' ? '跟随本机咚咚账户 · 登录过期时自动尝试连接' : state.loginMode === 'manual' ? '手动登录 · 不跟随咚咚切换账户' : '自动连接已暂停，选择一种方式重新登录')
let accountAction = 0
async function connect(mode: 'dongdong' | 'manual') {
  const ticket = ++accountAction; notice.value = ''
  try { await api.login(mode) } catch { if (ticket === accountAction) notice.value = '登录暂未完成，请重试或选择另一种登录方式' }
}
async function set<K extends keyof Settings>(key: K, value: Settings[K]) { try { await api.settings({ [key]: value }) } catch { notice.value = '设置暂未保存，请重试' } }
async function disconnect() {
  const ticket = ++accountAction; notice.value = ''
  try { await api.logout(); if (ticket === accountAction) notice.value = '已退出额度账户，咚咚消息不受影响' }
  catch { if (ticket === accountAction) notice.value = '退出状态暂未保存，请重试' }
}
</script>
<template>
  <section class="settings-panel">
    <header class="settings-header"><div><span class="eyebrow">MAKE IT YOURS</span><h1>你的桌面小伙伴</h1><p>把一点可爱，留在桌面上。</p></div><button class="icon-button close-settings" aria-label="关闭设置" @click="emit('close')"><PhX/></button></header>
    <div class="settings-layout">
      <nav class="settings-nav" aria-label="设置分类">
        <button :class="{ active: tab === 'appearance' }" @click="tab = 'appearance'"><PhFish/>外观与互动</button>
        <button :class="{ active: tab === 'desktop' }" @click="tab = 'desktop'"><PhDesktop/>桌面偏好</button>
        <button :class="{ active: tab === 'account' }" @click="tab = 'account'"><PhShieldCheck/>账户与额度</button>
        <button :class="{ active: tab === 'calendar' }" @click="tab = 'calendar'"><PhSun/>咚咚日程</button>
        <button :class="{ active: tab === 'messages' }" @click="tab = 'messages'"><PhShieldCheck/>咚咚消息</button>
        <button v-if="api.checkUpdate" :class="{ active: tab === 'updates' }" @click="tab = 'updates'"><PhDownloadSimple/>版本更新</button>
        <span class="nav-version">EM Use <small>v{{ state.version }}</small></span>
      </nav>
      <div class="settings-content">
        <template v-if="tab === 'appearance'">
          <h2>陪伴场景</h2><p class="section-description">小鱼、牛马、海狸鼠、仓鼠，陪你修行的小仙人，还有爱健身的电池人、圆滚滚的肥嘟嘟和爱留白的水墨小狐。</p><ScenePicker/>
          <h2>刚刚好的大小</h2><p class="section-description">从一整片小世界，到桌角的一点陪伴。</p>
          <div class="size-options"><button v-for="item in [{ id: 'standard', title: '标准', sub: '看见每个小细节' }, { id: 'compact', title: '紧凑', sub: '小巧，也很可爱' }, { id: 'mini', title: '迷你', sub: '轻轻待在桌角' }]" :key="item.id" :class="{ selected: state.settings.size === item.id }" @click="set('size', item.id as Settings['size'])"><BuddySprite v-if="state.settings.scene === 'buddy'" :skin="state.settings.buddySkin" class="size-buddy-preview" :class="item.id"/><BeaverSprite v-else-if="state.settings.scene === 'beaver'" class="size-beaver-preview" :class="item.id"/><span v-else-if="state.settings.scene === 'hamster'" class="hamster-settings-thumb" :class="item.id"><HamsterVisual level="full" :skin="state.settings.hamsterSkin" :reduced-motion="true"/></span><span v-else-if="state.settings.scene === 'battery'" class="battery-settings-thumb" :class="item.id"><BatteryVisual :percent="100" :skin="state.settings.batterySkin" :reduced-motion="true"/></span><span v-else-if="state.settings.scene === 'luckycat'" class="luckycat-settings-thumb" :class="item.id"><LuckyCatVisual :percent="100" :skin="state.settings.luckycatSkin" gentle paused/></span><span v-else-if="state.settings.scene === 'skadi'" class="skadi-settings-thumb" :class="item.id"><SkadiVisual :percent="100" :skin="skadiSelectedSkin(state.settings)" :form="state.settings.skadiForm" :weapon="state.settings.skadiWeapon" gentle paused/></span><span v-else-if="state.settings.scene === 'fox'" class="fox-settings-thumb" :class="item.id"><FoxVisual :percent="100" :skin="state.settings.foxSkin" gentle paused/></span><span v-else-if="state.settings.scene === 'dinosaur'" class="dinosaur-settings-thumb" :class="item.id"><DinosaurVisual :percent="100" :skin="state.settings.dinosaurSkin" gentle/></span><span v-else-if="state.settings.scene === 'feidudu'" class="feidudu-settings-thumb" :class="item.id"><FeiduduVisual :percent="100" :skin="state.settings.feiduduSkin" gentle/></span><CultivatorSprite v-else-if="state.settings.scene === 'cultivation'" class="cultivation-settings-thumb" :frame="0" :skin="state.settings.cultivationSkin"/><img v-else :src="'./assets/aquarium.webp'" alt="" :class="item.id"/><b>{{ item.title }}</b><small>{{ item.sub }}</small><PhCheck v-if="state.settings.size === item.id" class="selection-check"/></button></div>
          <label class="size-slider"><span>自由缩放 <b>{{ state.settings.windowWidth }} px</b></span><input aria-label="宠物窗口大小" type="range" min="180" max="800" step="10" :value="state.settings.windowWidth" @input="set('windowWidth', Number(($event.target as HTMLInputElement).value))"/><small>拖窗口四角，或按住 Ctrl / ⌘ 滚动鼠标。</small></label>
          <template v-if="state.settings.scene === 'buddy'"><h2>牛马衣橱</h2><p class="section-description">换个装扮，换份好心情。</p><BuddySkinPicker/></template>
          <template v-else-if="state.settings.scene === 'beaver'"><h2>海狸鼠天气装扮</h2><p class="section-description">晴雨雪风，选择今天的出门装扮。</p><BeaverSkinPicker/></template>
          <template v-else-if="state.settings.scene === 'cultivation'"><h2>修仙渡劫事务所</h2><p class="section-description">云海听雨，观星悟道。选择今天的仙境。</p><CultivationRealmPicker/><CultivationWardrobe/></template>
          <template v-else-if="state.settings.scene === 'hamster'"><h2>仓鼠动力机房</h2><p class="section-description">红发带、安全帽、雨衣、夏装、冬装和节日装，挑一套今天的心情。</p><HamsterSkinPicker/></template>
          <template v-else-if="state.settings.scene === 'battery'"><h2>电池人的运动衣橱</h2><BatteryWardrobe/></template>
          <template v-else-if="state.settings.scene === 'luckycat'"><h2>猫猫的换装衣橱</h2><p class="section-description">金链、唐装、围裙、睡衣，每套都能动起来。</p><LuckyCatWardrobe/></template>
          <template v-else-if="state.settings.scene === 'skadi'"><h2>月汐的衣橱</h2><p class="section-description">御姐与萝莉形态，各有六套衣装。</p><SkadiWardrobe/><h2>月汐的武器库</h2><SkadiArmory/></template>
          <template v-else-if="state.settings.scene === 'fox'"><h2>小狐狸的墨色</h2><p class="section-description">墨分五色，心有留白。</p><FoxWardrobe/></template>
          <template v-else-if="state.settings.scene === 'dinosaur'"><h2>小恐龙的心情衣橱</h2><p class="section-description">背刺还是橘子味，身体换个新颜色。</p><DinosaurWardrobe/></template>
          <template v-else-if="state.settings.scene === 'feidudu'"><h2>肥嘟嘟的甜味衣橱</h2><p class="section-description">换一份圆圆的好心情。</p><FeiduduWardrobe/></template>
          <template v-else><h2>小鱼衣橱</h2><p class="section-description">戴上喜欢的小装饰，一起出发。</p><OutfitPicker/></template>
          <h2>光线与氛围</h2><div class="theme-options"><button v-for="item in [{ id: 'auto', title: '跟随昼夜', icon: PhCircleHalf }, { id: 'day', title: '晴朗白天', icon: PhSun }, { id: 'night', title: '安静夜晚', icon: PhMoon }]" :key="item.id" :class="{ selected: state.settings.theme === item.id }" @click="set('theme', item.id as Settings['theme'])"><component :is="item.icon"/>{{ item.title }}</button></div>
          <label class="setting-row"><span><b>轻柔模式</b><small>减少动画，让小伙伴安静陪伴，也更省电。</small></span><input type="checkbox" role="switch" :checked="state.settings.reducedMotion" @change="set('reducedMotion', ($event.target as HTMLInputElement).checked)"/></label>
        </template>
        <template v-else-if="tab === 'desktop'">
          <h2>自在待在桌面上</h2><p class="section-description">按自己的习惯，安排小伙伴的位置。</p>
          <label v-for="item in [{ key: 'alwaysOnTop', name: '置顶显示', help: '切换其他应用时，也能看到小伙伴。' }, { key: 'clickThrough', name: '鼠标穿透', help: '点击会落到后方窗口；从系统托盘可随时关闭。' }, { key: 'launchAtLogin', name: '开机启动', help: '登录电脑后自动出现，安装版生效。' }, { key: 'notifications', name: '低额度提醒', help: '剩余低于 30% 和 10% 时，每日各提醒一次。' }]" :key="item.key" class="setting-row"><span><b>{{ item.name }}</b><small>{{ item.help }}</small></span><input type="checkbox" role="switch" :checked="state.settings[item.key as keyof Settings] === true" @change="set(item.key as keyof Settings, ($event.target as HTMLInputElement).checked)"/></label>
          <div class="soft-note">按住场景空白或宠物拖动，轻点仍可互动；玩法使用拖动时优先处理互动。拖动四角调整大小，移开鼠标后操作自动隐去。关闭悬浮窗后，从系统托盘恢复。</div>
        </template>
        <template v-else-if="tab === 'calendar'"><CalendarSettings/></template>
        <template v-else-if="tab === 'messages'"><MessageSettings/></template>
        <template v-else-if="tab === 'updates'">
          <h2>版本更新</h2><p class="section-description">当前版本 v{{ state.version }}，连接内网后可获取新版本。</p>
          <div class="soft-note" role="status">{{ state.update?.message ?? '尚未检查更新' }}<p v-if="state.update?.version">新版本 v{{ state.update.version }}</p><p v-if="state.update?.total">{{ Math.min(100, Math.round((state.update.downloaded ?? 0) / state.update.total * 100)) }}%</p></div>
          <p v-if="state.update?.notes" class="section-description" style="white-space: pre-wrap">{{ state.update.notes }}</p>
          <div class="account-actions"><button class="primary-button" :disabled="updateBusy" @click="checkUpdate">检查更新</button><button v-if="state.update?.status === 'available'" class="primary-button" @click="installUpdate">下载、安装并重启</button><button class="text-button" @click="api.openReleases()">手动下载<PhArrowSquareOut/></button></div>
        </template>
        <template v-else>
          <h2>额度账户 · AI 云平台</h2><p class="section-description">用于查询额度；咚咚消息始终跟随本机咚咚账户，可与此账户不同。</p>
          <div class="account-card"><PhShieldCheck weight="duotone"/><div><b>{{ accountTitle }}</b><p>{{ isDesktop ? loginDescription : '浏览器预览 · 未连接真实账户' }}</p><p v-if="state.account?.name && state.account?.id" class="account-id">账户 {{ state.account.id }}</p></div></div>
          <p class="account-status" role="status">{{ state.message }}</p>
          <div class="login-methods" aria-label="登录方式">
            <button :aria-pressed="state.loginMode === 'dongdong'" @click="connect('dongdong')"><b>使用咚咚账户</b><span>{{ state.syncing && state.loginMode === 'dongdong' ? '正在连接，可切换为手动登录' : '跟随本机咚咚，自动连接和同步' }}</span><PhCheck v-if="state.loginMode === 'dongdong'"/></button>
            <button :aria-pressed="state.loginMode === 'manual'" @click="connect('manual')"><b>{{ state.loginMode === 'manual' && connected ? '切换手动账户' : '手动登录其他账户' }}</b><span>通过官方窗口登录，保留你的选择</span><PhCheck v-if="state.loginMode === 'manual'"/></button>
          </div>
          <div v-if="state.quota" class="account-quota"><span>今日已用<b>¥{{ money(state.quota.used) }}</b></span><span>每日额度<b>¥{{ money(state.quota.limit) }}</b></span><span>每日重置<b>00:00 <small>北京时间</small></b></span></div>
          <p class="privacy-note">登录凭据仅保存在此设备；费用可能延迟数分钟，以平台返回的数据为准。{{ connected && !state.persistentLogin && isDesktop ? '当前仅在本次运行中保留登录。' : '' }}</p>
          <div class="account-actions"><button class="text-button" @click="api.openPortal()">前往平台<PhArrowSquareOut/></button><button v-if="state.loginMode !== 'signed-out' || connected" class="text-button danger-text" @click="disconnect"><PhSignOut/>{{ connected ? '退出额度账户' : '停止额度连接' }}</button></div>
          <div class="version-note"><span>EM Use v{{ state.version }}</span><button class="text-button" @click="api.openReleases()">下载新版本<PhDownloadSimple/></button></div>
        </template>
        <p v-if="notice" class="inline-notice" role="status">{{ notice }}</p>
      </div>
    </div>
  </section>
</template>
<style scoped>
.account-status{font-size:12px;line-height:1.7;color:#587d93;margin-top:14px;overflow-wrap:anywhere}
.account-id{overflow-wrap:anywhere}
.login-methods{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}
.login-methods button{position:relative;text-align:left;border:1px solid #d5e3ec;border-radius:12px;background:#fff;padding:16px 28px 16px 14px;color:#385970;min-width:0}
.login-methods button[aria-pressed=true]{border-color:#69a4c4;background:#edf7fc}
.login-methods button:focus-visible{outline:2px solid #387fa6;outline-offset:3px}
.login-methods b{display:block;font-size:12px;font-weight:600}
.login-methods span{display:block;margin-top:7px;font-size:11px;color:#738fa2;line-height:1.7}
.login-methods svg{position:absolute;right:10px;top:16px;width:14px;height:14px;color:#387fa6}
@media(max-width:600px){.login-methods{grid-template-columns:1fr}}
</style>
