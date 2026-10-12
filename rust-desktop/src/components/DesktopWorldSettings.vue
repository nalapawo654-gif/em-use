<script setup lang="ts">
import { computed, ref } from 'vue'
import { api, appState as state, isDesktop } from '../bridge'
const busy = ref(false), notice = ref('')
const supported = computed(() => isDesktop && state.desktopWorld?.supported === true)
const running = computed(() => state.desktopWorld?.status === 'running')
async function act(action: () => Promise<unknown>) {
  busy.value = true; notice.value = ''
  try { await action() } catch (error) { notice.value = typeof error === 'string' ? error : '操作未完成，请重试。' }
  finally { busy.value = false }
}
</script>
<template>
  <div class="world-settings">
    <h2>桌面世界</h2>
    <p class="section-description">让河床、水草和鱼群留在桌面图标后方，小伙伴仍能陪在桌角。</p>
    <div class="world-card"><span class="world-tag">RIVERBED · 河床</span><h3>一条安静流动的小河</h3><p>移动鼠标，看看鱼群的反应。投下一点鱼食，等它们游过来。</p><small>Windows · 主显示器 · 本地 3D 场景</small></div>
    <p v-if="!supported" class="soft-note">{{ isDesktop ? '桌面世界目前仅支持 Windows。' : '浏览器仅供画面和互动预览，不会设置系统壁纸。' }}</p>
    <label class="setting-row"><span><b>开启河床壁纸</b><small>保留桌面图标、框选和右键操作。关闭后恢复原来的桌面背景。</small></span><input aria-label="开启河床壁纸" type="checkbox" role="switch" :disabled="busy || !supported" :checked="supported && state.settings.worldEnabled" @change="act(() => api.settings({ worldEnabled: ($event.target as HTMLInputElement).checked }))"/></label>
    <div v-if="supported" class="soft-note" role="status">{{ state.desktopWorld?.message }}</div>
    <div class="account-actions">
      <button class="primary-button" :disabled="busy || !supported || !state.settings.worldEnabled || state.settings.reducedMotion" @click="act(() => api.settings({ worldPaused: !state.settings.worldPaused }))">{{ state.settings.worldPaused ? '继续河床' : '暂停河床' }}</button>
      <button class="text-button" :disabled="busy || !running" @click="act(async () => { await api.worldFeed?.(); notice = '已投喂一小撮鱼食。' })">投喂鱼食</button>
      <button v-if="supported && state.settings.worldEnabled && state.desktopWorld?.status === 'error'" class="text-button" :disabled="busy" @click="act(async () => { await api.worldRetry?.() })">重新加载河床</button>
    </div>
    <p v-if="state.settings.reducedMotion && supported" class="section-description">轻柔模式已开启，河床保持静止；关闭轻柔模式后可继续播放。</p>
    <p v-if="notice" class="inline-notice" role="status">{{ notice }}</p>
    <p v-else-if="state.desktopWorldNotice" class="inline-notice" role="status">{{ state.desktopWorldNotice }}</p>
    <p class="section-description">暂停后保留画面，停止游动与鼠标互动。投喂是本地视觉互动，不影响账户额度。</p>
    <a v-if="!isDesktop" class="text-button" href="./world.html?preview=1" target="_blank" rel="noopener">打开河床互动预览 ↗</a>
    <p class="world-credit">河床场景基于 Deskworlds · Chase Lean，使用 Three.js；均遵循 MIT 许可。</p>
  </div>
</template>
<style scoped>
.world-card{padding:26px;border-radius:16px;background:linear-gradient(125deg,#153d36,#284f41 60%,#486345);color:#edf5e8;margin:22px 0}
.world-tag{font-size:11px;letter-spacing:2px;color:#c1d6b1}.world-card h3{font-size:22px;margin:16px 0 12px;font-weight:500}.world-card p{font-size:13px;line-height:1.8;max-width:360px}.world-card small{display:block;margin-top:22px;color:#c1d6b1;font-size:11px}
.world-credit{font-size:11px;line-height:1.8;color:#738fa2;margin-top:30px}button:disabled,input:disabled{cursor:not-allowed;opacity:.45}
</style>
