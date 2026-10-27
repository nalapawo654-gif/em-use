-- EM Use 协作服务 · 阶段 B 续篇：Agent 身份、授权 Grant、发言与执行限额。
-- 对应 docs/agent-collaboration-v1-design.md 第 3.1 / 6.1 / 7.2 / 8 节。
--
-- 范围说明（刻意缩小，写在这里避免散落在代码注释里）：
--   * AgentInstance 归属一个用户，绑定一个房间，声明宿主与能力——不建 HostBinding
--     （本机目录/会话 ID 等属于本机状态，留给接执行适配器时再决定是否上行）。
--   * Grant 只覆盖「自动接单」的权限上限与时限（文档 7.2 表格），不含审批请求
--     （approval_requests 留给接真实执行适配器时再建，因为审批内容天然依赖宿主）。
--   * 发言限额（每分钟 6 条、因果链最多 4 次自动回复）在应用层用 messages 表
--     现有列计算，不新增限额专用表。

CREATE TABLE agent_bind_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    created_by UUID NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_by_agent_instance_id UUID,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    bind_code_id UUID NOT NULL REFERENCES agent_bind_codes(id),
    host_kind TEXT NOT NULL CHECK (
        host_kind IN ('codex', 'dsh', 'workbuddy', 'aiwork', 'ide', 'other')
    ),
    label TEXT NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (
        status IN ('connected', 'idle', 'busy', 'awaiting_authorization', 'offline', 'unknown')
    ),
    auto_reply_enabled BOOLEAN NOT NULL DEFAULT false,
    token_hash TEXT NOT NULL UNIQUE,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

ALTER TABLE agent_bind_codes
    ADD CONSTRAINT agent_bind_codes_used_by_fkey
    FOREIGN KEY (used_by_agent_instance_id) REFERENCES agent_instances(id);

CREATE INDEX agent_instances_room_idx ON agent_instances (room_id);
CREATE INDEX agent_instances_user_idx ON agent_instances (user_id);

-- 所有者授予的「自动接单」授权：范围（房间/任务发起人可选限定）、权限上限、时限。
-- 时限上限（8 小时）在应用层校验，不在 SQL 里写死，方便后续调整默认值不必迁移。
CREATE TABLE grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_instance_id UUID NOT NULL REFERENCES agent_instances(id),
    created_by UUID NOT NULL REFERENCES users(id),
    room_id UUID REFERENCES rooms(id),
    task_creator_id UUID REFERENCES users(id),
    permission TEXT NOT NULL CHECK (
        permission IN ('read_only', 'edit_files', 'execute_commands')
    ),
    auto_claim BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX grants_agent_instance_idx ON grants (agent_instance_id);

-- 消息的发送主体仍然是 sender_user_id（人），这里只追加「是否经由某个 Agent 发出」
-- 以及「是否属于自动回复」，用来做发言限额统计，不改变既有读写语义。
ALTER TABLE messages
    ADD COLUMN sender_agent_instance_id UUID REFERENCES agent_instances(id),
    ADD COLUMN auto_reply BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX messages_agent_instance_idx ON messages (sender_agent_instance_id, created_at);

-- 任务可以声明执行权限上限（只读分析 / 改文件 / 执行命令），自动接单必须有匹配的 Grant；
-- 用户触发模式不做硬限制，只作信息展示（文档 7.2：宿主沙箱由宿主自身负责）。
ALTER TABLE tasks
    ADD COLUMN required_permission TEXT NOT NULL DEFAULT 'read_only' CHECK (
        required_permission IN ('read_only', 'edit_files', 'execute_commands')
    );

-- 记录一次 Run 是否经由某个 Agent 实例发起，便于界面标注来源（文档 7.1：
-- 「用户触发模式的状态属于 Agent 上报，界面标注其来源，不冒充宿主进程事件」）。
ALTER TABLE runs
    ADD COLUMN started_via_agent_instance_id UUID REFERENCES agent_instances(id);
