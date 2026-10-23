<script setup lang="ts">
import { quotaDisplay as display } from '../bridge'
import { resetLabel, windowLabel } from '../shared/quotaSource'
defineProps<{ stacked?: boolean; compact?: boolean }>()
</script>

<template>
  <span v-if="display.source === 'Codex'" class="codex-readout" :class="{ 'is-stacked': stacked, 'is-compact': compact }">
    <span class="codex-readout-heading" :title="display.message"
      :aria-label="display.status === 'stale' ? 'Codex · 数据待更新' : undefined">{{ display.status === 'stale' ? 'Codex · 待更新' : display.status === 'ready' ? 'Codex · 剩余' : 'Codex · 未知' }}</span>
    <span v-if="display.windows.length" class="codex-readout-windows">
      <span v-for="window in display.windows" :key="window.id" class="codex-readout-window"
        :title="`${windowLabel(window)} · ${resetLabel(window.resetsAt)}${window.resetsAt === null ? '' : ' 重置'}`">
        <span class="codex-readout-label">{{ windowLabel(window).replace('窗口', '').replaceAll(' ', '') }}</span>
        <b class="codex-readout-value">{{ window.remainingPercent === null ? '—' : `${Math.round(window.remainingPercent)}%` }}</b>
      </span>
    </span>
    <b v-else class="codex-readout-value">—</b>
    <span v-if="!display.windows.length && display.status !== 'ready'" class="codex-readout-status">{{ display.status === 'connecting' ? '正在连接' : display.status === 'signed-out' || display.status === 'expired' ? '请连接账户' : '额度未知' }}</span>
  </span>
  <slot v-else />
</template>

<style scoped>
.codex-readout.codex-readout{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:.6cqw;width:100%;min-width:0;color:inherit;text-align:center;line-height:1.1;letter-spacing:0;font-family:inherit}
.codex-readout .codex-readout-heading{display:block;font-size:max(8px,2.1cqw);font-weight:500;line-height:1.2}
.codex-readout .codex-readout-windows{display:flex;justify-content:center;gap:2cqw;min-width:0}
.codex-readout .codex-readout-window{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:.4cqw;min-width:0}
.codex-readout .codex-readout-label{font-size:max(8px,2.4cqw);font-weight:500;line-height:1.1;white-space:nowrap}
.codex-readout .codex-readout-value{font:700 max(12px,4.2cqw)/1.1 Arial,sans-serif;letter-spacing:-.04em;font-variant-numeric:tabular-nums;white-space:nowrap;color:inherit}
.codex-readout .codex-readout-status{display:block;font-size:max(8px,2cqw);line-height:1.2;font-weight:400}
.codex-readout.is-stacked .codex-readout-windows{flex-direction:column;gap:1.5cqw}
.codex-readout.is-compact .codex-readout-window{flex-direction:row;gap:.6cqw}
.codex-readout.is-compact .codex-readout-value{font-size:max(12px,3.8cqw)}
</style>

<style>
/* Keep both readings inside the existing wooden sign at miniature sizes. */
@container(max-width:249px){
  .beaver-quota:has(.codex-readout){width:48%;height:42%}
  .beaver-quota-copy:has(.codex-readout){top:15%;height:44%}
  :is(.piranha-quota,.potato-quota):has(.codex-readout){top:81%;height:14%}
}
</style>
