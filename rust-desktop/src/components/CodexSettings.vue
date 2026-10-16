<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api, appState as state, isDesktop } from '../bridge'
import { windowLabel, resetLabel } from '../shared/quotaSource'
const executable = ref(state.settings.codexExecutable), home = ref(state.settings.codexHome), notice = ref(''), busy = ref(false)
watch(() => [state.settings.codexExecutable, state.settings.codexHome], () => { executable.value = state.settings.codexExecutable; home.value = state.settings.codexHome })
const codex = computed(() => state.codex)
async function connect(enabled: boolean) {
  busy.value = true; notice.value = ''
  try { await api.settings({ codexEnabled: enabled }); if (enabled) await api.refreshCodex?.() }
  catch { notice.value = 'Codex 连接设置未能完成，请重试' }
  finally { busy.value = false }
}
async function refresh() { busy.value = true; try { await api.refreshCodex?.() } catch { notice.value = '刷新失败，请重试' } finally { busy.value = false } }
async function save() {
  if (/[\x00-\x1f\x7f]/.test(executable.value + home.value) || executable.value.length > 4096 || home.value.length > 4096) { notice.value = '路径过长或包含控制字符'; return }
  busy.value = true
  try { await api.settings({ codexExecutable: executable.value.trim(), codexHome: home.value.trim() }); notice.value = '路径已保存'; if (state.settings.codexEnabled) await api.refreshCodex?.() }
  catch { notice.value = '路径暂未保存，请重试' } finally { busy.value = false }
}
async function bucket(event: Event) { try { await api.settings({ codexBucket: (event.target as HTMLSelectElement).value }) } catch { notice.value = '额度分组未能保存' } }
</script>
<template>
  <section class="codex-settings">
    <h2>额度账户 · Codex</h2>
    <p class="section-description">连接这台电脑上的 Codex，读取 ChatGPT 账户的实时额度。请先在 Codex 中登录。</p>
    <div class="account-card"><div><b>{{ codex?.account?.name ?? '尚未连接 Codex 账户' }}</b><p>{{ codex?.account?.plan ?? 'macOS / Windows 原生 Codex' }}</p></div></div>
    <p role="status">{{ !isDesktop ? '浏览器预览 · 以下为演示数据，不会连接真实账户' : codex?.message ?? '连接本机 Codex 后查看额度' }}</p>
    <div class="account-actions"><button class="primary-button" :disabled="busy || codex?.syncing" @click="state.settings.codexEnabled ? refresh() : connect(true)">{{ codex?.syncing || busy ? '正在连接…' : state.settings.codexEnabled ? '重新检测 / 刷新' : '连接本机 Codex' }}</button><button v-if="state.settings.codexEnabled" class="text-button" @click="connect(false)">断开监控</button></div>
    <label v-if="codex?.buckets.length" class="codex-field">桌宠使用的额度分组<select aria-label="Codex 额度分组" :value="state.settings.codexBucket" @change="bucket"><option v-if="!codex.buckets.some(b => b.id === state.settings.codexBucket)" :value="state.settings.codexBucket">{{ state.settings.codexBucket }}（暂不可用）</option><option v-for="item in codex.buckets" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
    <section v-for="item in codex?.buckets ?? []" :key="item.id" class="codex-bucket"><b>{{ item.name }}</b><div v-for="window in item.windows" :key="window.id" class="codex-window"><span>{{ windowLabel(window) }}</span><strong>{{ window.remainingPercent === null ? '—' : Math.round(window.remainingPercent) + '% 剩余' }}</strong><progress v-if="window.remainingPercent !== null" max="100" :value="window.remainingPercent" :aria-label="item.name + ' ' + windowLabel(window) + '剩余'"/><small>{{ resetLabel(window.resetsAt) }}{{ window.resetsAt === null ? '' : ' 重置' }}</small></div></section>
    <p v-if="codex?.receivedAt" class="section-description">{{ codex.status === 'ready' ? '同步时间' : '上次同步' }}：{{ new Date(codex.receivedAt).toLocaleString() }}</p>
    <p class="privacy-note">每分钟同步，失败时逐步延长间隔。断开监控不会退出 Codex，也不影响 AI 云平台、咚咚消息与日程。不读取聊天记录，不创建对话。</p>
    <details><summary>高级设置 · 自动检测失败时使用</summary><label class="codex-field">Codex 程序绝对路径<input v-model="executable" aria-label="Codex 程序路径" placeholder="留空自动检测；Windows 请指定 codex.exe" maxlength="4096"/></label><label class="codex-field">Codex 数据目录<input v-model="home" aria-label="Codex 数据目录" placeholder="留空使用 CODEX_HOME 或用户目录下的 .codex" maxlength="4096"/></label><p>Windows 仅支持原生 Codex；WSL 环境暂不接入。程序路径与数据目录需要属于同一套 Codex 环境。</p><button class="text-button" :disabled="busy" @click="save">保存路径并重新检测</button></details>
    <p v-if="notice" role="status">{{ notice }}</p>
  </section>
</template>
<style scoped>
.codex-settings{border-top:1px solid #d5e3ec;margin-top:26px;padding-top:8px;min-width:0}.codex-settings p{font-size:12px;line-height:1.7;color:#587d93;overflow-wrap:anywhere}.codex-field{display:grid;gap:7px;font-size:12px;margin:16px 0}.codex-field input,.codex-field select{width:100%;min-width:0;box-sizing:border-box;font:inherit;padding:10px;border:1px solid #bdcfdd;border-radius:8px;background:white;color:#243647}.codex-bucket{padding:14px;margin:12px 0;background:#f1f7fa;border-radius:12px;color:#385970;font-size:13px}.codex-window{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:14px}.codex-window progress{width:100%;grid-column:1/-1;height:8px;accent-color:#37838b}.codex-window small{grid-column:1/-1;color:#587d93}.codex-settings summary{cursor:pointer;font-size:12px;margin-top:18px}
</style>
