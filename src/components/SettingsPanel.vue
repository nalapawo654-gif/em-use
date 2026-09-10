<script setup lang="ts">
import { computed, ref } from 'vue'
import { PhX, PhArrowSquareOut, PhSignOut, PhDesktop, PhSun, PhMoon, PhCircleHalf, PhFish, PhCheck, PhShieldCheck, PhDownloadSimple } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop } from '../bridge'
import type { Settings } from '../shared/types'
import OutfitPicker from './OutfitPicker.vue'
import ScenePicker from './ScenePicker.vue'
import BuddySkinPicker from './BuddySkinPicker.vue'
import BuddySprite from './BuddySprite.vue'
import BeaverSprite from './BeaverSprite.vue'
import BeaverSkinPicker from './BeaverSkinPicker.vue'
import HamsterVisual from './HamsterVisual.vue'
import HamsterSkinPicker from './HamsterSkinPicker.vue'
import { money } from '../shared/quota'
const emit = defineEmits<{ close: [] }>()
const tab = ref('appearance'), notice = ref('')
const connected = computed(() => !!state.quota && !['expired', 'signed-out'].includes(state.status))
async function set<K extends keyof Settings>(key: K, value: Settings[K]) { try { await api.settings({ [key]: value }) } catch { notice.value = '设置暂未保存，请重试' } }
async function disconnect() { await api.logout(); notice.value = '已清除本机登录凭据' }
</script>
<template>
  <section class="settings-panel">
    <header class="settings-header"><div><span class="eyebrow">MAKE IT YOURS</span><h1>你的桌面小伙伴</h1><p>把一点可爱，留在桌面上。</p></div><button class="icon-button close-settings" aria-label="关闭设置" @click="emit('close')"><PhX/></button></header>
    <div class="settings-layout">
      <nav class="settings-nav" aria-label="设置分类">
        <button :class="{ active: tab === 'appearance' }" @click="tab = 'appearance'"><PhFish/>外观与互动</button>
        <button :class="{ active: tab === 'desktop' }" @click="tab = 'desktop'"><PhDesktop/>桌面偏好</button>
        <button :class="{ active: tab === 'account' }" @click="tab = 'account'"><PhShieldCheck/>账户与额度</button>
        <span class="nav-version">EM Use <small>v{{ state.version }}</small></span>
      </nav>
      <div class="settings-content">
        <template v-if="tab === 'appearance'">
          <h2>陪伴场景</h2><p class="section-description">小鱼、牛马、海狸鼠，还有努力发电的小仓鼠。</p><ScenePicker/>
          <h2>刚刚好的大小</h2><p class="section-description">从一整片小世界，到桌角的一点陪伴。</p>
          <div class="size-options"><button v-for="item in [{ id: 'standard', title: '标准', sub: '看见每个小细节' }, { id: 'compact', title: '紧凑', sub: '小巧，也很可爱' }, { id: 'mini', title: '迷你', sub: '轻轻待在桌角' }]" :key="item.id" :class="{ selected: state.settings.size === item.id }" @click="set('size', item.id as Settings['size'])"><BuddySprite v-if="state.settings.scene === 'buddy'" :skin="state.settings.buddySkin" class="size-buddy-preview" :class="item.id"/><BeaverSprite v-else-if="state.settings.scene === 'beaver'" class="size-beaver-preview" :class="item.id"/><span v-else-if="state.settings.scene === 'hamster'" class="hamster-settings-thumb" :class="item.id"><HamsterVisual level="full" :skin="state.settings.hamsterSkin" :reduced-motion="true"/></span><img v-else :src="'./assets/aquarium.png'" alt="" :class="item.id"/><b>{{ item.title }}</b><small>{{ item.sub }}</small><PhCheck v-if="state.settings.size === item.id" class="selection-check"/></button></div>
          <label class="size-slider"><span>自由缩放 <b>{{ state.settings.windowWidth }} px</b></span><input aria-label="宠物窗口大小" type="range" min="180" max="800" step="10" :value="state.settings.windowWidth" @input="set('windowWidth', Number(($event.target as HTMLInputElement).value))"/><small>拖窗口四角，或按住 Ctrl / ⌘ 滚动鼠标。</small></label>
          <template v-if="state.settings.scene === 'buddy'"><h2>牛马衣橱</h2><p class="section-description">换个装扮，换份好心情。</p><BuddySkinPicker/></template>
          <template v-else-if="state.settings.scene === 'beaver'"><h2>海狸鼠天气装扮</h2><p class="section-description">晴雨雪风，选择今天的出门装扮。</p><BeaverSkinPicker/></template>
          <template v-else-if="state.settings.scene === 'hamster'"><h2>仓鼠动力机房</h2><p class="section-description">红发带、安全帽、雨衣、夏装、冬装和节日装，挑一套今天的心情。</p><HamsterSkinPicker/></template>
          <template v-else><h2>小鱼衣橱</h2><p class="section-description">戴上喜欢的小装饰，一起出发。</p><OutfitPicker/></template>
          <h2>光线与氛围</h2><div class="theme-options"><button v-for="item in [{ id: 'auto', title: '跟随昼夜', icon: PhCircleHalf }, { id: 'day', title: '晴朗白天', icon: PhSun }, { id: 'night', title: '安静夜晚', icon: PhMoon }]" :key="item.id" :class="{ selected: state.settings.theme === item.id }" @click="set('theme', item.id as Settings['theme'])"><component :is="item.icon"/>{{ item.title }}</button></div>
          <label class="setting-row"><span><b>轻柔模式</b><small>减少动画，让小伙伴安静陪伴，也更省电。</small></span><input type="checkbox" role="switch" :checked="state.settings.reducedMotion" @change="set('reducedMotion', ($event.target as HTMLInputElement).checked)"/></label>
        </template>
        <template v-else-if="tab === 'desktop'">
          <h2>自在待在桌面上</h2><p class="section-description">按自己的习惯，安排小伙伴的位置。</p>
          <label v-for="item in [{ key: 'alwaysOnTop', name: '置顶显示', help: '切换其他应用时，也能看到小伙伴。' }, { key: 'clickThrough', name: '鼠标穿透', help: '点击会落到后方窗口；从系统托盘可随时关闭。' }, { key: 'launchAtLogin', name: '开机启动', help: '登录电脑后自动出现，安装版生效。' }, { key: 'notifications', name: '低额度提醒', help: '剩余低于 30% 和 10% 时，每日各提醒一次。' }]" :key="item.key" class="setting-row"><span><b>{{ item.name }}</b><small>{{ item.help }}</small></span><input type="checkbox" role="switch" :checked="state.settings[item.key as keyof Settings] === true" @change="set(item.key as keyof Settings, ($event.target as HTMLInputElement).checked)"/></label>
          <div class="soft-note">按住场景空白或宠物拖动，轻点仍可互动；玩法使用拖动时优先处理互动。拖动四角调整大小，移开鼠标后操作自动隐去。关闭悬浮窗后，从系统托盘恢复。</div>
        </template>
        <template v-else>
          <h2>AI 云平台</h2><p class="section-description">每日额度，随时心里有数。</p>
          <div class="account-card"><PhShieldCheck weight="duotone"/><div><b>{{ connected ? '已连接 AI 云平台' : '还没有连接账户' }}</b><p>{{ connected ? (isDesktop ? '已通过官方登录验证' : '当前为浏览器演示数据') : '通过官方扫码登录，自动同步你的额度。' }}</p></div></div>
          <div v-if="state.quota" class="account-quota"><span>今日已用<b>¥{{ money(state.quota.used) }}</b></span><span>每日额度<b>¥{{ money(state.quota.limit) }}</b></span><span>每日重置<b>00:00 <small>北京时间</small></b></span></div>
          <p class="privacy-note">登录凭据仅保存在此设备；费用可能延迟数分钟，以平台返回的数据为准。{{ connected && !state.persistentLogin && isDesktop ? '当前仅在本次运行中保留登录。' : '' }}</p>
          <div class="account-actions"><button class="primary-button" @click="api.login()">{{ connected ? '重新登录' : '登录 AI 云平台' }}</button><button class="text-button" @click="api.openPortal()">前往平台<PhArrowSquareOut/></button><button v-if="connected" class="text-button danger-text" @click="disconnect"><PhSignOut/>退出账户</button></div>
          <div class="version-note"><span>EM Use v{{ state.version }}</span><button class="text-button" @click="api.openReleases()">下载新版本<PhDownloadSimple/></button></div>
        </template>
        <p v-if="notice" class="inline-notice" role="status">{{ notice }}</p>
      </div>
    </div>
  </section>
</template>
