export interface User { id: string; username: string; display_name: string; is_admin: boolean }
export interface Binding { id: string; server_url: string; user_id: string; room_id: string; agent_id: string; host_kind: string; host_ref: string; scope: string; label: string; state_file: string; executable: string }
export interface Connection { server_url: string; user: User | null; session_key: string; last_room_id: string | null; bindings: Binding[]; mcp_executable: string; error?: string; remote_revoked?: boolean }
export interface Room { id: string; name: string; status: string; role: string; created_at: string }
export interface Member { user_id: string; username: string; display_name: string; role: string }
export interface Agent { id: string; room_id: string; owner_user_id: string; owner_username: string; host_kind: string; label: string; status: string; auto_reply_enabled: boolean; last_seen_at: string | null }
export interface Message { id: string; seq: number; sender_user_id: string; sender_agent_instance_id: string | null; reply_to_id: string | null; body: string; created_at: string; auto_reply: boolean }
export interface Task { id: string; room_id: string; created_by: string; title: string; description: string; acceptance_criteria: string; status: string; version: number; required_permission: string; assignee_user_id: string | null; target_user_id: string | null; blocked_reason: string | null }
export interface Artifact { id: string; task_id: string; run_id: string; kind: string; content?: string; content_hash: string; size_bytes: number; verification_summary: string; created_at: string }
export const emptyConnection = (): Connection => ({ server_url: '', user: null, session_key: '', last_room_id: null, bindings: [], mcp_executable: '' })
export const hostNames: Record<string,string> = { codex: 'Codex', dsh: 'DeepSeek Harness', aiwork: 'AiWork', workbuddy: 'WorkBuddy', ide: 'IDE 插件', other: '其他 MCP 客户端' }
export const taskNames: Record<string,string> = { pending: '等待领取', claimed: '等待手动触发', in_progress: '执行中', pending_review: '待验收', completed: '已验收', blocked: '已阻塞', cancelled: '已取消', failed: '失败' }
export function normalizedOrigin(value: string): string {
  const url = new URL(value.trim())
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('请使用 HTTPS 服务地址；仅本机可使用 HTTP，地址不带路径或凭据')
  return url.origin
}
export function mergeMessages(old: Message[], incoming: Message[]): Message[] {
  return [...new Map([...old, ...incoming].map(m => [m.id, m])).values()].sort((a,b) => a.seq-b.seq)
}
export function connectionLabel(agent: Agent, now = Date.now()): string {
  if (agent.status === 'offline') return '已离线'
  if (agent.last_seen_at && now - Date.parse(agent.last_seen_at) < 90_000) return '近期已登记 / 有心跳'
  return '已绑定 · 在线状态待确认'
}
export function hostConfig(binding: Binding): string {
  const env = { EM_USE_SERVER_URL: binding.server_url, EM_USE_STATE_FILE: binding.state_file, EM_USE_CREDENTIAL_STORE: 'keyring' }
  const quoted = (s: string) => JSON.stringify(s)
  if (binding.host_kind === 'codex') return `[mcp_servers.em_use]\ncommand = ${quoted(binding.executable)}\nstartup_timeout_sec = 30\ntool_timeout_sec = 60\n\n[mcp_servers.em_use.env]\n${Object.entries(env).map(([k,v]) => `${k} = ${quoted(v)}`).join('\n')}\n`
  if (binding.host_kind === 'dsh') return `- insert:\n    - id: em-use-${binding.id}\n      name: '@deepseek-ai/dsh-mcp-client'\n      config:\n        serverName: em_use\n        transport: stdio\n        command: ${quoted(binding.executable)}\n        env:\n${Object.entries(env).map(([k,v]) => `          ${k}: ${quoted(v)}`).join('\n')}\n        toolCallTimeoutMs: 60000\n        failOnStartupError: true\n`
  if (binding.host_kind === 'aiwork') return JSON.stringify({mcp:{em_use:{type:'local',command:[binding.executable],environment:env,enabled:true,timeout:60000}}},null,2)
  return JSON.stringify({mcpServers:{em_use:{command:binding.executable,args:[],env}}},null,2)
}
export function configInstructions(host: string): string {
  if (host === 'codex') return '合并到目标项目的 .codex/config.toml，重新进入该项目会话。若使用桌面全局配置，此身份会被多个会话共享；不可当作会话隔离。'
  if (host === 'dsh') return '合并到你登记的独立 profile 的 cordis.patch.yml。DSH desktop profile 会被其全部会话共享；不同项目请使用独立 profile，不能只更改会话名称。'
  if (host === 'aiwork') return '合并到目标会话目录的 .opencode/opencode.json，保留原有配置，并在 AiWork 重新加载该会话。此版本会重写全局配置，不要写入全局 opencode.json。'
  return '在该宿主的项目或会话 MCP 设置中合并配置。不同宿主的字段格式可能不同；此配置为通用 stdio 格式，保存后需实际调用验证。'
}
