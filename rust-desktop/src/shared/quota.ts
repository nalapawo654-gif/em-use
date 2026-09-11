import type { Quota, Mood } from './types.js'
export const QUOTA_URL = 'https://aihub.eastmoney.com/ai-cloud-hub/coding-plan/usage'
export const PORTAL_URL = 'https://aihub.eastmoney.com/personal'
export const AUTH_KEYS = ['X-Dong-Auth', 'X-Dong-User', 'X-Dong-Client'] as const
export type AuthHeaders = Record<typeof AUTH_KEYS[number], string>
export function captureHeaders(input: Record<string, string | string[]>): AuthHeaders | null {
  const result = {} as AuthHeaders
  for (const key of AUTH_KEYS) {
    const value = Object.entries(input).find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1]
    if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value)) return null
    result[key] = value
  }
  return result
}
export class QuotaError extends Error {
  constructor(public kind: 'expired' | 'forbidden' | 'unavailable' | 'network', message: string) { super(message) }
}
export function beijingDay(now: number | Date = Date.now()): string {
  return new Date(Number(now) + 8 * 3600_000).toISOString().slice(0, 10)
}
export function parseChinaTime(raw: unknown): number {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(raw)) return NaN
  return Date.parse(/[Zz]|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}+08:00`)
}
export function normalizeQuota(payload: unknown, now = Date.now()): Quota {
  const body = payload as { code?: unknown; data?: Record<string, unknown> }
  if (body?.code === '000401' || body?.code === '401') throw new QuotaError('expired', '登录已过期，请重新登录')
  if (body?.code === '000403' || body?.code === '403') throw new QuotaError('forbidden', '当前账号暂无个人额度访问权限')
  if (body?.code !== '000200' || !body.data) throw new QuotaError('unavailable', '平台暂未返回有效额度，请稍后重试')
  const d = body.data
  const decimal = (v: unknown) => (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v))) ? Number(v) : NaN
  const limit = decimal(d.dailyCostLimit), used = decimal(d.currentDayCost)
  const estimate = parseChinaTime(d.lastCostEstimateTime), server = parseChinaTime(d.currentTime)
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(used) || used < 0 || !Number.isFinite(estimate) || !Number.isFinite(server) || estimate > server + 60_000) {
    throw new QuotaError('unavailable', '额度或费用更新时间暂不可用')
  }
  // Integer ten-thousandths avoid binary-float money subtraction errors.
  const remaining = Math.max(0, Math.round(limit * 10000) - Math.round(used * 10000)) / 10000
  return { limit, used, remaining, percent: Math.max(0, Math.min(100, remaining / limit * 100)),
    exceeded: d.quotaExceeded === true || used >= limit, estimatedAt: String(d.lastCostEstimateTime),
    serverAt: String(d.currentTime), receivedAt: now, day: beijingDay(estimate) }
}
export function quotaFreshness(quota: Quota, now = Date.now()): 'ready' | 'stale' | 'resetting' {
  const currentDay = beijingDay(Math.max(now, parseChinaTime(quota.serverAt)))
  if (quota.day !== currentDay) return 'resetting'
  if (now - parseChinaTime(quota.estimatedAt) > 15 * 60_000 || now - quota.receivedAt > 3 * 60_000) return 'stale'
  return 'ready'
}
export function moodFor(percent: number): Mood {
  return percent > 60 ? 'abundant' : percent > 30 ? 'normal' : percent > 10 ? 'warning' : 'danger'
}
export function millisecondsToMidnight(now = Date.now()): number {
  return Date.parse(`${beijingDay(now)}T00:00:00+08:00`) + 86400_000 - now
}
export function money(value: number): string { return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
