import type { AppState, CodexWindow } from './types.js'
export function windowLabel(window: CodexWindow): string {
  const minutes = window.windowDurationMins
  if (minutes === null) return window.id === 'primary' ? '主要窗口' : '次要窗口'
  if (minutes === 10080) return '周窗口'
  if (minutes % 1440 === 0) return `${minutes / 1440} 天窗口`
  if (minutes % 60 === 0) return `${minutes / 60} 小时窗口`
  return `${minutes} 分钟窗口`
}
export function resetLabel(seconds: number | null): string {
  return seconds === null ? '重置时间未知' : new Date(seconds * 1000).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export function quotaPresentation(state: AppState, now = Date.now()) {
  if (state.settings.quotaSource !== 'codex') {
    const usable = !!state.quota && ['ready', 'stale'].includes(state.status)
    return { canRefresh: !!state.quota, status: state.status, message: state.message, syncing: state.syncing, percent: usable ? state.quota!.percent : null,
      label: '今日剩余', subtitle: usable ? `¥${state.quota!.remaining.toFixed(2)} / ¥${state.quota!.limit.toFixed(2)}` : 'AI 云平台',
      source: 'AI 云平台', receivedAt: state.quota?.receivedAt ?? null, bucket: null, windows: [] as CodexWindow[] }
  }
  const codex = state.settings.codexEnabled ? state.codex : undefined
  const bucket = codex?.buckets.find(b => b.id === state.settings.codexBucket) ?? null
  const windows = bucket?.windows.filter(w => w.remainingPercent !== null) ?? []
  const limiting = windows.reduce<CodexWindow | null>((least, w) => !least || w.remainingPercent! < least.remainingPercent! ? w : least, null)
  let status = codex?.status ?? 'signed-out'
  let message = codex?.message ?? '连接本机 Codex 后查看额度'
  if (status === 'ready' && (!bucket || !limiting)) { status = 'unavailable'; message = '所选额度分组暂无有效额度，请查看详情或选择其他分组' }
  if (status === 'ready' && ((codex?.receivedAt != null && now - codex.receivedAt > 180_000) || bucket?.windows.some(w => w.resetsAt !== null && w.resetsAt * 1000 <= now))) {
    status = 'stale'; message = '上次同步的额度，正在等待最新结果'
  }
  const usable = ['ready', 'stale'].includes(status)
  return { canRefresh: state.settings.codexEnabled, status, message, syncing: codex?.syncing ?? false, percent: usable ? limiting?.remainingPercent ?? null : null,
    label: limiting ? `Codex · ${windowLabel(limiting)}` : 'Codex 额度',
    subtitle: !limiting ? '等待额度同步' : `${status === 'stale' ? '上次记录 · ' : ''}${resetLabel(limiting.resetsAt)}${limiting.resetsAt === null ? '' : ' 重置'}`,
    source: 'Codex', receivedAt: codex?.receivedAt ?? null, bucket,
    // Preserve returned windows (including unknown percentages), but never expose
    // cached values after authentication fails or monitoring is disconnected.
    windows: (bucket?.windows ?? []).map(w => ({ ...w, remainingPercent: usable ? w.remainingPercent : null })) }
}
