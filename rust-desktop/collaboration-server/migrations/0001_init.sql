-- EM Use 协作服务 · 第一版骨架 Schema
-- 范围对应 docs/agent-collaboration-v1-design.md 第 8 节「必须建设的能力」的子集：
-- 身份与设备、房间与成员、消息与背景、任务与运行、成果。
-- 不包含 Agent 注册/能力探测、授权 Grant、事件 WSS 投递 outbox 去重表——留给后续阶段，
-- 本次只做一个房间内严格递增序号的 room_events 作为恢复来源（文档 4.1 / 6.3 / 7.3）。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES users(id),
    note TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    used_by UUID REFERENCES users(id),
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by UUID NOT NULL REFERENCES users(id),
    current_context_version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ
);

-- 房间内严格递增序号的分配器；写入 room_events / messages / context_versions 前先锁定并自增。
CREATE TABLE room_counters (
    room_id UUID PRIMARY KEY REFERENCES rooms(id),
    next_seq BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at TIMESTAMPTZ,
    UNIQUE (room_id, user_id)
);

CREATE TABLE context_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    version INT NOT NULL,
    body TEXT NOT NULL,
    updated_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, version)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    seq BIGINT NOT NULL,
    sender_user_id UUID NOT NULL REFERENCES users(id),
    reply_to_id UUID REFERENCES messages(id),
    mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
    body TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, seq),
    UNIQUE (room_id, idempotency_key)
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    created_by UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    acceptance_criteria TEXT NOT NULL,
    allowed_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    assignment_mode TEXT NOT NULL CHECK (assignment_mode IN ('directed', 'open')),
    target_user_id UUID REFERENCES users(id),
    assignee_user_id UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'claimed', 'in_progress', 'pending_review', 'completed', 'blocked', 'failed', 'cancelled')
    ),
    blocked_reason TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (assignment_mode <> 'directed' OR target_user_id IS NOT NULL)
);

CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id),
    run_generation INT NOT NULL,
    execution_mode TEXT NOT NULL CHECK (execution_mode IN ('auto', 'user_triggered')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (
        status IN ('queued', 'starting', 'running', 'awaiting_approval', 'cancelling', 'succeeded', 'failed', 'cancelled', 'unknown')
    ),
    started_by UUID NOT NULL REFERENCES users(id),
    idempotency_key TEXT NOT NULL,
    lease_expires_at TIMESTAMPTZ,
    blocked_reason TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (task_id, idempotency_key),
    UNIQUE (task_id, run_generation)
);

-- 同一任务只允许一个处于「活跃」状态的 Run（文档 7.1：同一 Task 最多一个有效 Run）。
CREATE UNIQUE INDEX runs_single_active_per_task
    ON runs (task_id)
    WHERE status IN ('queued', 'starting', 'running', 'awaiting_approval', 'cancelling');

CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id),
    run_id UUID NOT NULL REFERENCES runs(id),
    submitted_by UUID NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('text', 'markdown', 'json', 'log', 'diff')),
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    verification_summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (size_bytes <= 10485760)
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id),
    artifact_id UUID REFERENCES artifacts(id),
    reviewer_id UUID NOT NULL REFERENCES users(id),
    decision TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 房间内唯一的恢复来源：事件按房间严格递增序号写入，与业务变更同事务提交（文档 4.1 / 6.3）。
CREATE TABLE room_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    seq BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    caused_by_event_id UUID REFERENCES room_events(id),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, seq)
);

CREATE INDEX room_events_room_seq_idx ON room_events (room_id, seq);
CREATE INDEX messages_room_seq_idx ON messages (room_id, seq);
CREATE INDEX memberships_user_idx ON memberships (user_id, status);
CREATE INDEX tasks_room_status_idx ON tasks (room_id, status);
