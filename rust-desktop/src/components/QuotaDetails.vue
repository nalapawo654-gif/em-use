<script setup lang="ts">
import { ref } from 'vue'
import { api, appState, quotaState as state, quotaDisplay as display } from '../bridge'
import { resetLabel, windowLabel } from '../shared/quotaSource'
const error = ref('')
async function source(event: Event) {
  try { await api.settings({ quotaSource: (event.target as HTMLSelectElement).value as 'eastmoney' | 'codex' }); error.value = '' }
  catch { error.value = '额度来源未能保存，请重试' }
}
async function refresh() { try { await api.refresh(); error.value = '' } catch { error.value = '刷新失败，请稍后重试' } }
async function connect() { try { await api.openPortal() } catch { error.value = '账户设置未能打开，请重试' } }
</script>
<template>
  <div class="shared-quota-details" data-pet-gesture>
    <label>额度来源 <select aria-label="额度来源" :value="state.settings.quotaSource" @change="source"><option value="eastmoney">AI 云平台</option><option value="codex">Codex</option></select></label>
    <p role="status">{{ state.message }}</p>
    <template v-if="state.settings.quotaSource === 'codex'">
      <p v-if="appState.codex?.account">{{ appState.codex.account.name }}<span v-if="appState.codex.account.plan"> · {{ appState.codex.account.plan }}</span></p>
      <section v-for="bucket in appState.codex?.buckets ?? []" :key="bucket.id" class="quota-bucket">
        <b>{{ bucket.name }}{{ bucket.id === state.settings.codexBucket ? ' · 桌宠展示' : '' }}</b>
        <dl><div v-for="window in bucket.windows" :key="window.id"><dt>{{ windowLabel(window) }}</dt><dd>{{ window.remainingPercent === null ? '—' : `${Math.round(window.remainingPercent)}% 剩余` }}<small>{{ resetLabel(window.resetsAt) }}{{ window.resetsAt === null ? '' : ' 重置' }}</small></dd></div></dl>
      </section>
      <p>桌宠跟随所选分组中剩余比例较低的有效窗口；各窗口分别计算。重置后以重新同步结果为准。</p>
    </template>
    <template v-else-if="state.quota">
      <dl><div><dt>{{ state.status === 'ready' ? '今日剩余' : '上次记录剩余' }}</dt><dd>¥{{ state.quota.remaining.toFixed(2) }}</dd></div><div><dt>每日额度</dt><dd>¥{{ state.quota.limit.toFixed(2) }}</dd></div><div><dt>费用日期</dt><dd>{{ state.quota.day }}</dd></div></dl>
      <p>北京时间每日 00:00 重置，以平台同步结果为准。</p>
    </template>
    <p v-if="display.receivedAt">{{ state.status === 'ready' ? '同步时间' : '上次同步' }}：{{ new Date(display.receivedAt).toLocaleString() }}</p>
    <small>互动和换装不会消耗或恢复真实额度。</small>
    <div class="quota-actions"><button :disabled="state.syncing || !display.canRefresh" @click="refresh">{{ state.syncing ? '正在刷新' : '刷新额度' }}</button><button @click="connect">{{ state.settings.quotaSource === 'codex' ? '连接与分组设置' : '在平台查看' }}</button></div>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
<style scoped>
.shared-quota-details{display:block;font-size:12px;line-height:1.6;min-width:0;overflow-wrap:anywhere;text-align:left;max-height:55vh;overflow-y:auto}
.shared-quota-details label{font-size:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.shared-quota-details select{font:inherit;max-width:100%;padding:5px;border:1px solid currentColor;border-radius:6px;color:inherit;background:transparent}.shared-quota-details option{color:#243647;background:white}
.shared-quota-details dl{font-size:12px;margin:8px 0}.shared-quota-details dl>div{display:flex;justify-content:space-between;gap:8px;margin:6px 0;flex-wrap:wrap}.shared-quota-details dd{margin:0;text-align:right}.shared-quota-details dd small{display:block;font-size:10px}.shared-quota-details p{font-size:11px;line-height:1.7;margin:8px 0}.quota-bucket{margin-top:12px}.quota-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.quota-actions button{font:inherit;color:inherit;border:1px solid currentColor;border-radius:7px;padding:5px 8px;background:transparent}.quota-actions button:disabled{opacity:.5}
</style>
