-- Explicit human approval for one agent, task version and run attempt.
CREATE TABLE task_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id),
    agent_instance_id UUID NOT NULL REFERENCES agent_instances(id),
    created_by UUID NOT NULL REFERENCES users(id),
    task_version INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- unknown means execution may still be running; never schedule another run automatically.
CREATE UNIQUE INDEX runs_one_unresolved_per_task ON runs(task_id)
    WHERE status IN ('queued','starting','running','awaiting_approval','cancelling','unknown');
