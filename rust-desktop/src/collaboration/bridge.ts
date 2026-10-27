import { isTauri, invoke } from '@tauri-apps/api/core'
import { emptyConnection, normalizedOrigin, type Connection } from './model'
export type Transport = <T>(action: string, payload?: Record<string, unknown>) => Promise<T>
// Browser mode is a real API preview with memory-only authentication. Native
// mode never exposes human or agent credentials to the renderer.
let preview = emptyConnection(), token = ''
async function browserRequest(method: string, path: string, body?: unknown) {
  const base = import.meta.env.DEV && preview.server_url === (import.meta.env.VITE_COLLABORATION_DEV_SERVER || 'http://127.0.0.1:8797') ? '/collaboration-api' : preview.server_url
  const response = await fetch(base + path, {method, headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, body:body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(20000), redirect:'error'})
  const value = await response.json()
  if (!response.ok) throw new Error(`${response.status}：${value.message || '协作请求失败'}`)
  return value
}
export const transport: Transport = async <T>(action: string, payload: Record<string,unknown> = {}): Promise<T> => {
  if (isTauri()) return invoke<T>('collaboration', {action,payload})
  if (action === 'restore') return {...preview} as T
  if (action === 'connect') {
    token='';preview=emptyConnection();preview.server_url=normalizedOrigin(String(payload.server_url))
    const auth=await browserRequest('POST',`/v1/auth/${payload.mode || 'login'}`,payload)
    token=auth.session_token;preview.user=auth.user;preview.session_key=`${preview.server_url}|${auth.user.id}`
    try { preview.last_room_id=localStorage.getItem(`em-use-room:${preview.session_key}`) } catch {}
    return {...preview} as T
  }
  if (payload.session_key !== preview.session_key || !token) throw new Error('连接已切换，请重新登录')
  if (action === 'disconnect') {
    let remote_revoked=false
    try { await browserRequest('POST','/v1/auth/logout',{});remote_revoked=true } catch { /* Local logout must also work offline. */ } finally { token='';preview={...emptyConnection(),server_url:preview.server_url} }
    return {...preview,remote_revoked} as T
  }
  if (action === 'selectRoom') {
    preview.last_room_id=String(payload.room_id)
    try { localStorage.setItem(`em-use-room:${preview.session_key}`,preview.last_room_id) } catch {}
    return {...preview} as T
  }
  if (action === 'request') return browserRequest(String(payload.method),String(payload.path),payload.body)
  throw new Error('本机 Agent 绑定与钥匙串配置需要在桌面应用中操作；浏览器不模拟接入成功')
}
export const native = isTauri()
export async function openCollaboration() {
  if (isTauri()) await invoke('desktop',{action:'openCollaboration'})
  else window.open('./collaboration.html','em-use-collaboration','noopener')
}
