//! Agent 身份、Grant 授权与发言限额的集成测试。
//!
//! 覆盖设计文档 7.2 节表格里能在服务端强制的部分：
//!   * auto 执行模式必须用 Agent 令牌，且必须有匹配的 Grant（房间/发起人/权限上限）；
//!   * Grant 时限不能超过 8 小时；
//!   * Agent 自动发言默认关闭，开启后仍受「每分钟 6 条」与「因果链最多 4 次」限制；
//!   * 不能自动回复自己刚发的消息；
//!   * 撤销 Agent / 撤销 Grant 立即生效。

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    Router,
};
use em_use_collaboration_server::{app, db, state::AppState};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;

async fn test_pool() -> PgPool {
    let url = std::env::var("EM_USE_TEST_DATABASE_URL")
        .expect("set EM_USE_TEST_DATABASE_URL to a disposable em_use_collab_test_* database");
    let pool = db::connect(&url).await.expect("connect test db");
    let name: String = sqlx::query_scalar("SELECT current_database()")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(
        name.starts_with("em_use_collab_test_"),
        "Refusing to truncate a non-test database"
    );
    db::migrate(&pool).await.expect("migrate test db");
    sqlx::query(
        "TRUNCATE users, invites, sessions, devices, rooms, room_counters, memberships, \
         context_versions, messages, tasks, runs, artifacts, reviews, room_events, \
         agent_bind_codes, agent_instances, grants CASCADE",
    )
    .execute(&pool)
    .await
    .expect("truncate test db");
    pool
}

async fn call(
    router: &Router,
    method: Method,
    uri: &str,
    token: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(t) = token {
        builder = builder.header("Authorization", format!("Bearer {t}"));
    }
    let request = if let Some(b) = body {
        builder
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&b).unwrap()))
            .unwrap()
    } else {
        builder.body(Body::empty()).unwrap()
    };
    let response = router.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or(Value::Null)
    };
    (status, value)
}

fn s(v: &Value, key: &str) -> String {
    v[key].as_str().unwrap_or_default().to_string()
}

async fn bootstrap_user(router: &Router, username: &str) -> (String, String) {
    // 第一次调用用 bootstrap 建管理员账户，后续用户通过该管理员发邀请注册。
    let (status, auth) = call(
        router,
        Method::POST,
        "/v1/auth/bootstrap",
        None,
        Some(json!({"username": username, "password": "passw0rd!", "display_name": username})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{auth:?}");
    (s(&auth, "session_token"), s(&auth["user"], "id"))
}

async fn invite_and_register(
    router: &Router,
    admin_token: &str,
    username: &str,
) -> (String, String) {
    let (status, invite) = call(
        router,
        Method::POST,
        "/v1/auth/invites",
        Some(admin_token),
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{invite:?}");
    let invite_token = s(&invite, "invite_token");
    let (status, auth) = call(
        router,
        Method::POST,
        "/v1/auth/register",
        None,
        Some(json!({
            "invite_token": invite_token,
            "username": username,
            "password": "passw0rd!",
            "display_name": username,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{auth:?}");
    (s(&auth, "session_token"), s(&auth["user"], "id"))
}

async fn bind_agent(
    router: &Router,
    room_owner_token: &str,
    room_id: &str,
    host_kind: &str,
    label: &str,
) -> (String, String) {
    let (status, code) = call(
        router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/agent-bind-codes"),
        Some(room_owner_token),
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{code:?}");
    let bind_code = s(&code, "bind_code");
    let (status, bound) = call(
        router,
        Method::POST,
        "/v1/agents/bind",
        None,
        Some(json!({
            "bind_code": bind_code,
            "host_kind": host_kind,
            "label": label,
            "capabilities": {"canUseRoomTools": true},
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{bound:?}");
    (s(&bound, "agent_instance_id"), s(&bound, "agent_token"))
}

#[tokio::test]
async fn agent_identity_grant_and_speech_limits() {
    let pool = test_pool().await;
    let router = app(AppState { pool: pool.clone() });

    let (alice_token, alice_id) = bootstrap_user(&router, "alice").await;
    let (bob_token, bob_id) = invite_and_register(&router, &alice_token, "bob").await;

    let (status, room) = call(
        &router,
        Method::POST,
        "/v1/rooms",
        Some(&alice_token),
        Some(json!({"name": "demo"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let room_id = s(&room, "id");
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/members"),
        Some(&alice_token),
        Some(json!({"username": "bob"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // ---- 1. 绑定码一次性使用；绑定后 Agent 归属发码人 ----
    let (alice_agent_id, alice_agent_token) =
        bind_agent(&router, &alice_token, &room_id, "dsh", "Alice DSH").await;

    let (status, code2) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/agent-bind-codes"),
        Some(&alice_token),
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let reusable_code = s(&code2, "bind_code");
    let (status, _) = call(
        &router,
        Method::POST,
        "/v1/agents/bind",
        None,
        Some(json!({"bind_code": reusable_code, "host_kind": "codex", "label": "x", "capabilities": {}})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "绑定码第一次应当成功");
    let (status, _) = call(
        &router,
        Method::POST,
        "/v1/agents/bind",
        None,
        Some(json!({"bind_code": reusable_code, "host_kind": "codex", "label": "y", "capabilities": {}})),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "绑定码不能重复使用");

    // ---- 2. 房间成员都能看到接入的 Agent 列表 ----
    let (status, agents) = call(
        &router,
        Method::GET,
        &format!("/v1/rooms/{room_id}/agents"),
        Some(&bob_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let agents = agents.as_array().unwrap();
    assert!(!agents.is_empty());
    assert_eq!(agents[0]["owner_username"], "alice");
    assert_eq!(agents[0]["status"], "connected");

    // ---- 3. 心跳必须用该 Agent 自己的令牌，不能被房主或别人代发 ----
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/agents/{alice_agent_id}/heartbeat"),
        Some(&alice_token),
        Some(json!({"status": "idle"})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "人类会话令牌不能代替 Agent 上报心跳"
    );
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/agents/{alice_agent_id}/heartbeat"),
        Some(&alice_agent_token),
        Some(json!({"status": "idle"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // ---- 4. 开启自动发言必须是所有者本人，别人操作不到 ----
    let (status, _) = call(
        &router,
        Method::PATCH,
        &format!("/v1/agents/{alice_agent_id}"),
        Some(&bob_token),
        Some(json!({"auto_reply_enabled": true})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "非所有者不能修改别人的 Agent 设置"
    );
    let (status, _) = call(
        &router,
        Method::PATCH,
        &format!("/v1/agents/{alice_agent_id}"),
        Some(&alice_token),
        Some(json!({"auto_reply_enabled": true})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // ---- 5. auto 执行模式必须用 Agent 令牌；没有 Grant 也必须被拒绝 ----
    let (status, task) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/tasks"),
        Some(&alice_token),
        Some(json!({
            "title": "自动化分析",
            "description": "跑一遍静态检查",
            "acceptance_criteria": "报告无 P0",
            "assignment_mode": "directed",
            "target_username": "alice",
            "required_permission": "edit_files",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{task:?}");
    let task_id = s(&task, "id");
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/claim"),
        Some(&alice_token),
        Some(json!({"expected_version": 1})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/start"),
        Some(&alice_token),
        Some(json!({"idempotency_key": "r1", "execution_mode": "auto"})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "人类会话令牌不能用 auto 执行模式"
    );

    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/start"),
        Some(&alice_agent_token),
        Some(json!({"idempotency_key": "r2", "execution_mode": "auto"})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "没有匹配 Grant 时 auto 模式必须被拒绝"
    );

    // ttl 超过 8 小时必须被拒绝。
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/agents/{alice_agent_id}/grants"),
        Some(&alice_token),
        Some(json!({"permission": "edit_files", "auto_claim": true, "ttl_hours": 9})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "Grant 时限不能超过 8 小时");

    // 权限不够的 Grant（read_only）不能覆盖要求 edit_files 的任务。
    let (status, low_grant) = call(
        &router,
        Method::POST,
        &format!("/v1/agents/{alice_agent_id}/grants"),
        Some(&alice_token),
        Some(json!({"room_id": room_id, "permission": "read_only", "auto_claim": true, "ttl_hours": 1})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{low_grant:?}");
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/start"),
        Some(&alice_agent_token),
        Some(json!({"idempotency_key": "r3", "execution_mode": "auto"})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "read_only Grant 不能覆盖 edit_files 任务"
    );

    // 权限足够、房间匹配的 Grant 必须放行，并记录是经由该 Agent 启动的。
    let (status, grant) = call(
        &router,
        Method::POST,
        &format!("/v1/agents/{alice_agent_id}/grants"),
        Some(&alice_token),
        Some(json!({"room_id": room_id, "permission": "edit_files", "auto_claim": true, "ttl_hours": 1})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{grant:?}");
    let (status, run) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/start"),
        Some(&alice_agent_token),
        Some(json!({"idempotency_key": "r4", "execution_mode": "auto"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{run:?}");
    assert_eq!(
        run["started_via_agent_instance_id"].as_str(),
        Some(alice_agent_id.as_str())
    );

    // ---- 6. 撤销 Grant 后，新任务立刻拿不到自动授权 ----
    let grant_id = s(&grant, "id");
    let (status, _) = call(
        &router,
        Method::DELETE,
        &format!("/v1/grants/{grant_id}"),
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, task2) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/tasks"),
        Some(&alice_token),
        Some(json!({
            "title": "第二个任务", "description": "x", "acceptance_criteria": "x",
            "assignment_mode": "directed", "target_username": "alice",
            // 显式要求 edit_files：之前留着的 low_grant 只有 read_only，
            // 不能覆盖，这样才能单独验证「撤销后的 edit_files Grant 不再生效」。
            "required_permission": "edit_files",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let task2_id = s(&task2, "id");
    call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task2_id}/claim"),
        Some(&alice_token),
        Some(json!({"expected_version": 1})),
    )
    .await;
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task2_id}/start"),
        Some(&alice_agent_token),
        Some(json!({"idempotency_key": "r5", "execution_mode": "auto"})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "撤销后的 Grant 不能再用于自动启动"
    );

    // ---- 7. 撤销 Agent 后令牌立即失效 ----
    let (status, _) = call(
        &router,
        Method::DELETE,
        &format!("/v1/agents/{alice_agent_id}"),
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/agents/{alice_agent_id}/heartbeat"),
        Some(&alice_agent_token),
        Some(json!({"status": "idle"})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::UNAUTHORIZED,
        "撤销后的 Agent 令牌必须立即失效"
    );

    // ============ 发言限额：换用 bob 的 Agent，避免和上面的 Grant 测试共用速率窗口 ============
    let (bob_agent_id, bob_agent_token) =
        bind_agent(&router, &bob_token, &room_id, "codex", "Bob Codex").await;

    // 默认关闭自动发言。
    let (status, seed) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_token),
        Some(json!({"body": "有人在吗", "idempotency_key": "seed-0"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let seed_id = s(&seed, "id");
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_agent_token),
        Some(json!({"body": "在的", "idempotency_key": "auto-0", "reply_to_id": seed_id, "auto_reply": true})),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "默认关闭自动发言时必须拒绝");

    call(
        &router,
        Method::PATCH,
        &format!("/v1/agents/{bob_agent_id}"),
        Some(&bob_token),
        Some(json!({"auto_reply_enabled": true})),
    )
    .await;

    // 自动回复必须带 reply_to_id。
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_agent_token),
        Some(json!({"body": "没头没尾", "idempotency_key": "auto-noreply", "auto_reply": true})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "自动回复必须带 reply_to_id"
    );

    // ---- 8. 因果链最多连续 4 次自动回复，第 5 次必须被拒绝 ----
    // 两个不同 Agent 交替回复（而不是同一个 Agent 回复自己上一条），这样才能
    // 单独验证链长限制，不会和「不能自动回复自己」的规则混在一起。
    let (alice_agent2_id, alice_agent2_token) =
        bind_agent(&router, &alice_token, &room_id, "dsh", "Alice DSH 2").await;
    let _ = alice_agent2_id;
    call(
        &router,
        Method::PATCH,
        &format!("/v1/agents/{alice_agent2_id}"),
        Some(&alice_token),
        Some(json!({"auto_reply_enabled": true})),
    )
    .await;
    let agents_in_order = [
        &bob_agent_token,
        &alice_agent2_token,
        &bob_agent_token,
        &alice_agent2_token,
    ];
    let mut last_id = seed_id.clone();
    for (i, token) in agents_in_order.iter().enumerate() {
        let (status, m) = call(
            &router,
            Method::POST,
            &format!("/v1/rooms/{room_id}/messages"),
            Some(token),
            Some(json!({
                "body": format!("自动回复第 {i} 条"),
                "idempotency_key": format!("chain-{i}"),
                "reply_to_id": last_id,
                "auto_reply": true,
            })),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "第 {i} 条自动回复应当成功: {m:?}");
        last_id = s(&m, "id");
    }
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_agent_token),
        Some(json!({
            "body": "第 5 条",
            "idempotency_key": "chain-4",
            "reply_to_id": last_id,
            "auto_reply": true,
        })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "因果链第 5 次连续自动回复必须被拒绝"
    );

    // ---- 9. 不能自动回复自己刚发的消息 ----
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_agent_token),
        Some(json!({
            "body": "回复自己",
            "idempotency_key": "self-reply",
            "reply_to_id": last_id,
            "auto_reply": true,
        })),
    )
    .await;
    // 注意：这里 last_id 指向的消息已经处在一条满 4 步的自动回复链末端，
    // 不管谁来接都会被链长限制拦住；只要不是 200 即可证明被拦住。
    // 单独验证「不能自动回复自己」用下面一条新的种子消息，不走满链长。
    assert_ne!(status, StatusCode::OK);

    let (status, seed2) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_token),
        Some(json!({"body": "换个话题", "idempotency_key": "seed-1"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let seed2_id = s(&seed2, "id");
    let (status, own_reply) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_agent_token),
        Some(json!({
            "body": "我来接",
            "idempotency_key": "own-1",
            "reply_to_id": seed2_id,
            "auto_reply": true,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{own_reply:?}");
    let own_reply_id = s(&own_reply, "id");
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_agent_token),
        Some(json!({
            "body": "再回自己一次",
            "idempotency_key": "own-2",
            "reply_to_id": own_reply_id,
            "auto_reply": true,
        })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "不能自动回复自己刚发的消息");

    // ---- 9b. Agent 自己的读取游标：只能自己推进，别人（即便是所有者）代不了 ----
    let (status, self_info) = call(
        &router,
        Method::GET,
        &format!("/v1/agents/{bob_agent_id}"),
        Some(&bob_agent_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{self_info:?}");
    assert_eq!(self_info["acked_seq"], 0);
    let (status, _) = call(
        &router,
        Method::GET,
        &format!("/v1/agents/{bob_agent_id}"),
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "非所有者查不到别人 Agent 的自身状态"
    );
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/agents/{bob_agent_id}/ack"),
        Some(&bob_token),
        Some(json!({"seq": 5})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "连所有者本人都不能代替 Agent 推进游标"
    );
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/agents/{bob_agent_id}/ack"),
        Some(&bob_agent_token),
        Some(json!({"seq": 5})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/agents/{bob_agent_id}/ack"),
        Some(&bob_agent_token),
        Some(json!({"seq": 2})),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "游标只会前进，倒退的 seq 不报错但也不生效"
    );
    let (status, self_info2) = call(
        &router,
        Method::GET,
        &format!("/v1/agents/{bob_agent_id}"),
        Some(&bob_agent_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(self_info2["acked_seq"], 5, "游标不能被更小的 seq 拉倒退");

    // ---- 10. 每个 Agent 每分钟最多 6 条自动回复 ----
    // 换一个全新的 Agent，避免和上面链长测试已经消耗的速率窗口互相干扰：
    // 6 条各自独立的短链（每条只回一条人类消息，链长 1）全部成功，第 7 条必须被拒绝。
    let (rate_agent_id, rate_agent_token) =
        bind_agent(&router, &alice_token, &room_id, "dsh", "Alice DSH 限额测试").await;
    call(
        &router,
        Method::PATCH,
        &format!("/v1/agents/{rate_agent_id}"),
        Some(&alice_token),
        Some(json!({"auto_reply_enabled": true})),
    )
    .await;
    for i in 0..6 {
        let (status, seed) = call(
            &router,
            Method::POST,
            &format!("/v1/rooms/{room_id}/messages"),
            Some(&bob_token),
            Some(json!({"body": format!("种子消息 {i}"), "idempotency_key": format!("rate-seed-{i}")})),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let seed_id = s(&seed, "id");
        let (status, m) = call(
            &router,
            Method::POST,
            &format!("/v1/rooms/{room_id}/messages"),
            Some(&rate_agent_token),
            Some(json!({
                "body": format!("自动回复种子 {i}"),
                "idempotency_key": format!("rate-reply-{i}"),
                "reply_to_id": seed_id,
                "auto_reply": true,
            })),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "第 {i} 条应在限额内: {m:?}");
    }
    let (status, seed7) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_token),
        Some(json!({"body": "种子消息 6", "idempotency_key": "rate-seed-6"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let seed7_id = s(&seed7, "id");
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&rate_agent_token),
        Some(json!({
            "body": "第 7 条自动回复",
            "idempotency_key": "rate-reply-6",
            "reply_to_id": seed7_id,
            "auto_reply": true,
        })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "超过每分钟 6 条自动回复必须被拒绝"
    );

    let _ = (bob_id, alice_id);
    pool.close().await;
}
