<script setup lang="ts">
import PetNotices from './PetNotices.vue'
import BuddyMessageParcel from './BuddyMessageParcel.vue'
import '../buddy/message.css'
import { computed, ref } from 'vue'
import { PhGearSix, PhMinus, PhX, PhHeart, PhSun, PhMoon, PhArrowCounterClockwise, PhTShirt, PhInfo, PhArrowsClockwise, PhSignIn, PhHandTap, PhGameController } from '@phosphor-icons/vue'
import { api, appState as state, isDesktop, previewQuota } from '../bridge'
import { useWindowGestures } from '../windowGestures'
import type { Corner } from '../shared/windowGeometry'
import { BUDDY_STATES, buddyLevel, type BuddyAction } from '../buddy/play'
import type { BuddyProp } from '../buddy/sprites'
import BuddyScene from './BuddyScene.vue'
import BuddySprite from './BuddySprite.vue'
import BuddySkinPicker from './BuddySkinPicker.vue'
const props = defineProps<{ percent: number | null; night: boolean; usable: boolean }>()
const emit = defineEmits<{ settings: [] }>()
const scene = ref<InstanceType<typeof BuddyScene> | null>(null), wardrobe = ref(false), details = ref(false), moreActions = ref(false)
const { moving, down, move, end, click, wheel } = useWindowGestures()
const corners: Corner[] = ['nw', 'ne', 'sw', 'se']
const interactions: { action: BuddyAction; label: string; prop: BuddyProp; hint: string }[] = [
  { action: 'feed', label: '喂草', prop: 'grass', hint: '吃草补充能量\n看起来更饱满' },
  { action: 'drink', label: '喝水', prop: 'water', hint: '喝水解渴\n恢复活力' },
  { action: 'pet', label: '摸摸', prop: 'hand', hint: '摸一摸，心情变好\n还会摇尾巴' },
  { action: 'clean', label: '清洁', prop: 'brush', hint: '洗个澡，干干净净\n心情更舒畅' },
  { action: 'play', label: '玩耍', prop: 'ball', hint: '踢踢球，活动一下\n保持好状态' },
  { action: 'swat', label: '驱蚊', prop: 'mosquito', hint: '尾巴打蚊子\n赶走烦人的小虫子' },
]
const extras: { action: BuddyAction; label: string; level: number; prop?: BuddyProp }[] = [
  { action: 'wag', label: '开心摇尾巴', level: 0 }, { action: 'sleep', label: '打盹休息', level: 2 },
  { action: 'shake', label: '站立抖一抖', level: 0 }, { action: 'rest', label: '撑不住了', level: 3 },
  { action: 'inflate', label: '努力充气中', level: 1, prop: 'pump' },
]
const statusLabel = computed(() => ({ ready: '已同步', stale: '数据待更新', expired: '请重新登录', resetting: '同步今日额度', unavailable: '额度暂不可用', forbidden: '暂无访问权限', 'signed-out': '等待连接', connecting: '等待登录' }[state.status]))
function act(action: BuddyAction) { wardrobe.value = false; details.value = false; moreActions.value = false; scene.value?.act(action) }
function chooseState(percent: number) { previewQuota(percent); scene.value?.cancel() }
</script>

<template>
  <div class="buddy-experience" :class="{ 'buddy-native': isDesktop }">
    <div class="buddy-main-column">
      <section class="buddy-widget" :class="{ 'is-moving': moving, 'has-panel': wardrobe || details || moreActions, 'has-mail': state.settings.messageEnabled && (!!state.messages?.items.length || state.messages?.status === 'paused') }" aria-label="充气牛马场景" @pointerdown.capture="down($event)" @pointermove.capture="move" @pointerup="end" @pointercancel="end" @click.capture="click" @wheel="wheel" @contextmenu.prevent="moreActions = !moreActions; wardrobe = false; details = false" @keydown.esc="wardrobe = false; details = false; moreActions = false">
        <PetNotices :blocked="wardrobe || details || moreActions || moving || !!scene?.updateBlocked" :message-blocked="wardrobe || details || moreActions || moving" :message-deferred="!!scene?.updateBlocked"><template #parcel><BuddyMessageParcel/></template></PetNotices>
        <BuddyScene ref="scene" :percent="percent" :remaining="usable ? state.quota?.remaining : undefined" :limit="usable ? state.quota?.limit : undefined" :skin="state.settings.buddySkin" :night="night" :reduced-motion="state.settings.reducedMotion" :muted="['stale', 'expired', 'resetting'].includes(state.status)"/>
        <header class="buddy-header"><div class="buddy-title"><BuddySprite/><div><h1>充气牛马</h1><p>努力工作 · 快速回血</p></div></div><div class="buddy-window-actions"><button aria-label="更多牛马动作" title="更多牛马动作" @click="moreActions = !moreActions; wardrobe = false; details = false"><PhGameController/></button><button aria-label="牛马换装" title="牛马换装" @click="wardrobe = !wardrobe; details = false; moreActions = false"><PhTShirt/></button><button aria-label="设置" title="设置" @click="emit('settings')"><PhGearSix/></button><span></span><button aria-label="收起到托盘" title="收起到托盘" @click="api.hide()"><PhMinus/></button></div></header>
        <nav class="buddy-tools" aria-label="照顾牛马"><button v-for="item in interactions" :key="item.action" :aria-label="item.label" @click="act(item.action)"><BuddySprite :prop="item.prop"/><span>{{ item.label }}</span></button></nav>
        <button v-if="!usable" class="buddy-login" @click="api.login()"><PhSignIn/>{{ state.status === 'signed-out' ? '连接账户' : statusLabel }}</button>
        <button class="buddy-status" @click="details = !details; wardrobe = false"><PhInfo/>{{ statusLabel }}</button>
        <section v-if="wardrobe" class="buddy-panel" role="dialog" aria-label="牛马衣橱"><header><b>今天，想做哪只牛马？</b><button aria-label="关闭牛马衣橱" @click="wardrobe = false"><PhX/></button></header><BuddySkinPicker/></section>
        <section v-if="moreActions" class="buddy-panel" role="dialog" aria-label="牛马游乐场"><header><b>忙里偷闲，陪牛马玩一会儿</b><button aria-label="关闭牛马游乐场" @click="moreActions = false"><PhX/></button></header><div class="buddy-extras"><button v-for="item in extras" :key="item.action" @click="act(item.action)"><div class="buddy-mini-scene"><BuddySprite :skin="state.settings.buddySkin" :level="item.level"/><BuddySprite v-if="item.prop" :prop="item.prop" class="mini-prop"/></div><b>{{ item.label }}</b></button></div><p class="buddy-play-note">双击牛马可切换站立 / 趴下；互动不会改变平台额度。</p></section>
        <section v-if="details" class="buddy-panel buddy-details" role="dialog" aria-label="牛马额度详情"><header><b>今日额度</b><button aria-label="关闭额度详情" @click="details = false"><PhX/></button></header><p>{{ state.message }}</p><small>互动陪伴不会改变平台额度，每日 00:00 重置。</small><button class="text-button" :disabled="state.syncing || !state.quota" @click="api.refresh()"><PhArrowsClockwise :class="{ spin: state.syncing }"/>刷新额度</button></section>
        <button v-for="corner in (isDesktop ? corners : [])" :key="corner" class="buddy-resize" :class="corner" :aria-label="`缩放牛马 ${corner}`" @pointerdown.stop="down($event, corner)" @pointermove="move" @keydown.up.prevent="api.settings({ windowWidth: state.settings.windowWidth + 10 })" @keydown.down.prevent="api.settings({ windowWidth: state.settings.windowWidth - 10 })"><PhArrowCounterClockwise/></button>
      </section>
      <section v-if="!isDesktop" class="buddy-card buddy-extra-card"><header><h2>更多有趣的动作</h2><span>忙里偷闲，也很可爱</span></header><div class="buddy-extras"><button v-for="item in extras" :key="item.action" @click="act(item.action)"><div class="buddy-mini-scene" :class="'mini-' + item.action"><BuddySprite :skin="state.settings.buddySkin" :level="item.level"/><BuddySprite v-if="item.prop" :prop="item.prop" class="mini-prop"/><PhMoon v-if="item.action === 'sleep'" class="mini-effect"/><PhHeart v-if="item.action === 'wag'" class="mini-effect"/></div><b>{{ item.label }}</b></button></div></section>
    </div>
    <div v-if="!isDesktop" class="buddy-side-column">
      <p class="buddy-handwritten">打工不易，且用且珍惜！<PhHeart/></p>
      <section class="buddy-card buddy-state-card"><header><h2>不同额度状态</h2><span>额度越低，牛马越瘪</span><small>演示数据</small></header><div class="buddy-states"><button v-for="(item, index) in BUDDY_STATES" :key="item.percent" :class="['state-' + index, { selected: percent !== null && buddyLevel(percent) === index }]" :aria-label="`预览额度 ${item.percent}%`" :aria-pressed="percent !== null && buddyLevel(percent) === index" @click="chooseState(item.percent)"><div class="buddy-state-art"><BuddySprite :skin="state.settings.buddySkin" :level="index"/></div><span class="buddy-percent">{{ item.percent }}%</span><b>状态：{{ item.label }}</b><small>{{ item.hint }}</small></button></div></section>
      <section class="buddy-card buddy-interaction-card"><header><h2>互动场景</h2><span>丰富的互动，让监控更有趣</span></header><div class="buddy-interactions"><button v-for="item in interactions" :key="item.action" :aria-label="`体验${item.label}`" @click="act(item.action)"><div class="buddy-mini-scene" :class="'mini-' + item.action"><BuddySprite :skin="state.settings.buddySkin" :level="item.action === 'feed' || item.action === 'drink' ? 2 : 0"/><BuddySprite :prop="item.prop" class="mini-prop"/></div><b>{{ item.label }}</b><small>{{ item.hint }}</small></button></div></section>
      <section class="buddy-card buddy-skin-card"><header><h2>可选主题 / 皮肤</h2><span>多种皮肤，随心切换</span></header><BuddySkinPicker/></section>
    </div>
    <footer v-if="!isDesktop" class="buddy-bottom"><p>照顾好你的牛马，<br/>给专注的日子加点可爱。<PhHeart/></p><div class="buddy-inventory"><button v-for="item in interactions.filter(i => i.action !== 'swat')" :key="item.action" :aria-label="`使用${item.label}道具`" @click="act(item.action)"><BuddySprite :prop="item.prop"/><span>{{ { feed: '草料', drink: '水桶', pet: '摸摸', clean: '刷子', play: '足球' }[item.action as 'feed' | 'drink' | 'pet' | 'clean' | 'play'] }}</span></button><button aria-label="使用打气筒" @click="act('inflate')"><BuddySprite prop="pump"/><span>打气筒</span></button></div><div class="buddy-tips"><PhHandTap/><span>小贴士<br/><b>双击牛马，可以切换站立 / 躺下</b></span><button @click="api.settings({ theme: night ? 'day' : 'night' })"><PhSun v-if="night"/><PhMoon v-else/>{{ night ? '切换白天' : '看看夜晚' }}</button></div></footer>
  </div>
</template>
