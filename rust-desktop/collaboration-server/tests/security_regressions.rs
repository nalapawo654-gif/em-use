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

async fn ok(router: &Router, method: Method, path: &str, token: &str, body: Value) -> Value {
    let (status, value) = call(
        router,
        method,
        path,
        Some(token),
        if body.is_null() { None } else { Some(body) },
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{path}: {value}");
    value
}

#[tokio::test]
async fn session_restore_returns_identity_without_credentials_and_rejects_agent_or_revoked_session() {
    let pool = test_pool().await;
    let router = app(AppState { pool });
    let (human, user_id) = bootstrap_user(&router, "restore_owner").await;
    let identity = ok(&router, Method::GET, "/v1/auth/me", &human, Value::Null).await;
    assert_eq!(identity["id"], user_id);
    assert_eq!(identity.as_object().unwrap().len(), 4);
    assert!(identity.get("session_token").is_none());
    let room = ok(&router, Method::POST, "/v1/rooms", &human, json!({"name":"restore"})).await;
    let (_, agent) = bind_agent(&router, &human, &s(&room,"id"), "codex", "test").await;
    let (status, _) = call(&router, Method::GET, "/v1/auth/me", Some(&agent), None).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    ok(&router, Method::POST, "/v1/auth/logout", &human, json!({})).await;
    let (status, _) = call(&router, Method::GET, "/v1/auth/me", Some(&human), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}
async fn claimed(router: &Router, room: &str, human: &str) -> Value {
    let task=ok(router,Method::POST,&format!("/v1/rooms/{room}/tasks"),human,json!({"title":"test","description":"scope","acceptance_criteria":"evidence","assignment_mode":"open"})).await;
    ok(
        router,
        Method::POST,
        &format!("/v1/tasks/{}/claim", s(&task, "id")),
        human,
        json!({"expected_version":task["version"]}),
    )
    .await
}
async fn start(router: &Router, task: &Value, human: &str) -> Value {
    ok(
        router,
        Method::POST,
        &format!("/v1/tasks/{}/start", s(task, "id")),
        human,
        json!({"idempotency_key":"first","execution_mode":"user_triggered"}),
    )
    .await
}
fn artifact(run: &Value) -> Value {
    json!({"run_id":run["id"],"kind":"text","content":"result","verification_summary":"checked"})
}

#[tokio::test]
async fn authorization_scope_leases_cancellation_and_artifact_regressions() {
    let pool = test_pool().await;
    let router = app(AppState { pool: pool.clone() });
    let (human, _) = bootstrap_user(&router, "alice").await;
    let room = ok(
        &router,
        Method::POST,
        "/v1/rooms",
        &human,
        json!({"name":"A"}),
    )
    .await;
    let other = ok(
        &router,
        Method::POST,
        "/v1/rooms",
        &human,
        json!({"name":"B"}),
    )
    .await;
    let room_id = s(&room, "id");
    let other_id = s(&other, "id");
    let (agent_id, agent) = bind_agent(&router, &human, &room_id, "codex", "one").await;
    let (_, sibling) = bind_agent(&router, &human, &room_id, "dsh", "two").await;
    // Agent tokens never inherit the human control plane, including explicit manual flags.
    for (method, path, body) in [
        (
            Method::POST,
            "/v1/auth/devices".into(),
            json!({"name":"privileged"}),
        ),
        (Method::POST, "/v1/auth/invites".into(), json!({})),
        (
            Method::POST,
            "/v1/rooms".into(),
            json!({"name":"unauthorized"}),
        ),
        (
            Method::PATCH,
            format!("/v1/agents/{agent_id}"),
            json!({"auto_reply_enabled":true}),
        ),
        (
            Method::POST,
            format!("/v1/agents/{agent_id}/grants"),
            json!({"permission":"execute_commands","auto_claim":true,"ttl_hours":1}),
        ),
        (
            Method::POST,
            format!("/v1/rooms/{room_id}/agent-bind-codes"),
            json!({}),
        ),
        (
            Method::PUT,
            format!("/v1/rooms/{room_id}/context"),
            json!({"expected_version":0,"body":"context"}),
        ),
    ] {
        assert_eq!(
            call(&router, method, &path, Some(&agent), Some(body))
                .await
                .0,
            StatusCode::FORBIDDEN,
            "{path}"
        );
    }
    for suffix in [
        "messages", "tasks", "events", "context", "members", "agents",
    ] {
        assert_eq!(
            call(
                &router,
                Method::GET,
                &format!("/v1/rooms/{other_id}/{suffix}"),
                Some(&agent),
                None
            )
            .await
            .0,
            StatusCode::FORBIDDEN
        );
    }
    assert_eq!(
        call(
            &router,
            Method::GET,
            &format!("/v1/agents/{agent_id}"),
            Some(&sibling),
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let task = claimed(&router, &room_id, &human).await;
    let task_id = s(&task, "id");
    for mode in ["auto", "user_triggered"] {
        assert_eq!(
            call(
                &router,
                Method::POST,
                &format!("/v1/tasks/{task_id}/start"),
                Some(&agent),
                Some(json!({"idempotency_key":"deny","execution_mode":mode}))
            )
            .await
            .0,
            StatusCode::FORBIDDEN
        );
    }
    let permit_body = json!({"agent_instance_id":agent_id,"expected_version":task["version"]});
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/tasks/{task_id}/authorize"),
            Some(&agent),
            Some(permit_body.clone())
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let permit = ok(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/authorize"),
        &human,
        permit_body,
    )
    .await;
    let start_body = json!({"idempotency_key":"manual","execution_mode":"user_triggered","authorization_token":permit["authorization_token"]});
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/tasks/{task_id}/start"),
            Some(&sibling),
            Some(start_body.clone())
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let run = ok(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/start"),
        &agent,
        start_body.clone(),
    )
    .await;
    let run_id = s(&run, "id");
    assert_eq!(
        ok(
            &router,
            Method::POST,
            &format!("/v1/tasks/{task_id}/start"),
            &agent,
            start_body.clone()
        )
        .await["id"],
        run["id"]
    );
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/tasks/{task_id}/start"),
            Some(&sibling),
            Some(start_body)
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/runs/{run_id}/update"),
            Some(&sibling),
            Some(json!({"kind":"progress"}))
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let updated = ok(
        &router,
        Method::POST,
        &format!("/v1/runs/{run_id}/update"),
        &agent,
        json!({"kind":"progress"}),
    )
    .await;
    let expiry =
        chrono::DateTime::parse_from_rfc3339(updated["lease_expires_at"].as_str().unwrap())
            .unwrap();
    assert!(
        (expiry.with_timezone(&chrono::Utc) - chrono::Utc::now()).num_seconds() > 850,
        "manual lease must remain 15 minutes"
    );
    // A cancellation request is not a process stop; no subsequent success is valid.
    assert_eq!(
        ok(
            &router,
            Method::POST,
            &format!("/v1/runs/{run_id}/cancel"),
            &human,
            Value::Null
        )
        .await["status"],
        "cancelling"
    );
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/tasks/{task_id}/artifact"),
            Some(&agent),
            Some(artifact(&run))
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/runs/{run_id}/update"),
            Some(&agent),
            Some(json!({"kind":"progress"}))
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        ok(
            &router,
            Method::POST,
            &format!("/v1/runs/{run_id}/update"),
            &agent,
            json!({"kind":"cancelled"})
        )
        .await["status"],
        "cancelled"
    );
    // Expired run becomes unknown, blocks new generations, and needs human stop confirmation.
    let timed = claimed(&router, &room_id, &human).await;
    let timed_id = s(&timed, "id");
    let expired = start(&router, &timed, &human).await;
    let expired_id = s(&expired, "id");
    sqlx::query("UPDATE runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1::uuid")
        .bind(&expired_id)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/tasks/{timed_id}/artifact"),
            Some(&human),
            Some(artifact(&expired))
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        ok(
            &router,
            Method::GET,
            &format!("/v1/runs/{expired_id}"),
            &human,
            Value::Null
        )
        .await["status"],
        "unknown"
    );
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/tasks/{timed_id}/start"),
            Some(&human),
            Some(json!({"idempotency_key":"second","execution_mode":"user_triggered"}))
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/runs/{expired_id}/resolve"),
            Some(&agent),
            Some(json!({"confirmed_stopped":true,"outcome":"failed","note":"stopped"}))
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    ok(
        &router,
        Method::POST,
        &format!("/v1/runs/{expired_id}/resolve"),
        &human,
        json!({"confirmed_stopped":true,"outcome":"failed","note":"checked host process stopped"}),
    )
    .await;
    let rerun = ok(
        &router,
        Method::POST,
        &format!("/v1/tasks/{timed_id}/start"),
        &human,
        json!({"idempotency_key":"second","execution_mode":"user_triggered"}),
    )
    .await;
    let result = ok(
        &router,
        Method::POST,
        &format!("/v1/tasks/{timed_id}/artifact"),
        &human,
        artifact(&rerun),
    )
    .await;
    let result_id = s(&result, "id");
    let list = ok(
        &router,
        Method::GET,
        &format!("/v1/tasks/{timed_id}/artifact"),
        &agent,
        Value::Null,
    )
    .await;
    assert_eq!(list[0]["id"], result["id"]);
    assert!(list[0].get("content").is_none());
    assert_eq!(
        ok(
            &router,
            Method::GET,
            &format!("/v1/tasks/{timed_id}/artifact/{result_id}"),
            &agent,
            Value::Null
        )
        .await["content"],
        "result"
    );
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/tasks/{timed_id}/review"),
            Some(&agent),
            Some(json!({"decision":"accepted","artifact_id":result_id}))
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let different = claimed(&router, &other_id, &human).await;
    let different_id = s(&different, "id");
    let different_run = start(&router, &different, &human).await;
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/tasks/{different_id}/artifact"),
            Some(&agent),
            Some(artifact(&different_run))
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    let foreign = ok(
        &router,
        Method::POST,
        &format!("/v1/tasks/{different_id}/artifact"),
        &human,
        artifact(&different_run),
    )
    .await;
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/tasks/{timed_id}/review"),
            Some(&human),
            Some(json!({"decision":"accepted","artifact_id":foreign["id"]}))
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        call(
            &router,
            Method::GET,
            &format!("/v1/tasks/{different_id}/artifact/{}", s(&foreign, "id")),
            Some(&agent),
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    ok(
        &router,
        Method::POST,
        &format!("/v1/tasks/{timed_id}/review"),
        &human,
        json!({"decision":"accepted","artifact_id":result_id}),
    )
    .await;
    // Removal invalidates human assignee writes and the bound Agent token.
    let (bob, bob_id) = invite_and_register(&router, &human, "bob").await;
    ok(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/members"),
        &human,
        json!({"username":"bob","role":"member"}),
    )
    .await;
    let (_, bob_agent) = bind_agent(&router, &bob, &room_id, "ide", "bob").await;
    let owned = claimed(&router, &room_id, &bob).await;
    let owned_id = s(&owned, "id");
    let owned_run = start(&router, &owned, &bob).await;
    let owned_run_id = s(&owned_run, "id");
    let queued = claimed(&router, &room_id, &bob).await;
    ok(
        &router,
        Method::DELETE,
        &format!("/v1/rooms/{room_id}/members/{bob_id}"),
        &human,
        Value::Null,
    )
    .await;
    for (path, body) in [
        (
            format!("/v1/tasks/{}/start", s(&queued, "id")),
            json!({"idempotency_key":"removed","execution_mode":"user_triggered"}),
        ),
        (
            format!("/v1/runs/{owned_run_id}/update"),
            json!({"kind":"progress"}),
        ),
        (format!("/v1/runs/{owned_run_id}/cancel"), Value::Null),
        (
            format!("/v1/tasks/{owned_id}/artifact"),
            artifact(&owned_run),
        ),
    ] {
        assert_eq!(
            call(
                &router,
                Method::POST,
                &path,
                Some(&bob),
                if body.is_null() { None } else { Some(body) }
            )
            .await
            .0,
            StatusCode::FORBIDDEN,
            "{path}"
        );
    }
    assert_eq!(
        call(
            &router,
            Method::GET,
            &format!("/v1/rooms/{room_id}/messages"),
            Some(&bob_agent),
            None
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
    // Agent auto_reply=false cannot bypass disabled speech or concurrent rate limits.
    let seed = ok(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/messages"),
        &human,
        json!({"body":"seed","idempotency_key":"seed"}),
    )
    .await;
    let speech = json!({"body":"reply","reply_to_id":seed["id"],"idempotency_key":"speech","auto_reply":false});
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/rooms/{room_id}/messages"),
            Some(&agent),
            Some(speech)
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    ok(
        &router,
        Method::PATCH,
        &format!("/v1/agents/{agent_id}"),
        &human,
        json!({"auto_reply_enabled":true}),
    )
    .await;
    let mut jobs = tokio::task::JoinSet::new();
    for i in 0..12 {
        let r = router.clone();
        let a = agent.clone();
        let path = format!("/v1/rooms/{room_id}/messages");
        let parent = seed["id"].clone();
        jobs.spawn(async move {call(&r,Method::POST,&path,Some(&a),Some(json!({"body":"reply","reply_to_id":parent,"idempotency_key":format!("rate-{i}"),"auto_reply":false}))).await.0});
    }
    let mut accepted = 0;
    while let Some(job) = jobs.join_next().await {
        match job.unwrap() {
            StatusCode::OK => accepted += 1,
            StatusCode::CONFLICT => {}
            other => panic!("unexpected status {other}"),
        }
    }
    assert_eq!(accepted, 6);
    // Grant revocation also prevents progress and artifacts on an already running auto Run.
    let automatic = claimed(&router, &room_id, &human).await;
    let automatic_id = s(&automatic, "id");
    let grant = ok(
        &router,
        Method::POST,
        &format!("/v1/agents/{agent_id}/grants"),
        &human,
        json!({"permission":"read_only","auto_claim":true,"ttl_hours":1}),
    )
    .await;
    let auto_run = ok(
        &router,
        Method::POST,
        &format!("/v1/tasks/{automatic_id}/start"),
        &agent,
        json!({"idempotency_key":"auto","execution_mode":"auto"}),
    )
    .await;
    let auto_id = s(&auto_run, "id");
    let expiry =
        chrono::DateTime::parse_from_rfc3339(auto_run["lease_expires_at"].as_str().unwrap())
            .unwrap()
            .with_timezone(&chrono::Utc);
    assert!((expiry - chrono::Utc::now()).num_seconds() <= 90);
    ok(
        &router,
        Method::DELETE,
        &format!("/v1/grants/{}", s(&grant, "id")),
        &human,
        Value::Null,
    )
    .await;
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/runs/{auto_id}/update"),
            Some(&agent),
            Some(json!({"kind":"progress"}))
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(
            &router,
            Method::POST,
            &format!("/v1/tasks/{automatic_id}/artifact"),
            Some(&agent),
            Some(artifact(&auto_run))
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    ok(
        &router,
        Method::POST,
        &format!("/v1/runs/{auto_id}/cancel"),
        &human,
        Value::Null,
    )
    .await;
    assert_eq!(
        ok(
            &router,
            Method::POST,
            &format!("/v1/runs/{auto_id}/update"),
            &agent,
            json!({"kind":"cancelled"})
        )
        .await["status"],
        "cancelled"
    );
    // Background expiration uses the same guarded transition.
    sqlx::query("UPDATE runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1::uuid")
        .bind(&owned_run_id)
        .execute(&pool)
        .await
        .unwrap();
    em_use_collaboration_server::handlers::tasks::expire_runs(&pool)
        .await
        .unwrap();
    assert_eq!(
        ok(
            &router,
            Method::GET,
            &format!("/v1/runs/{owned_run_id}"),
            &human,
            Value::Null
        )
        .await["status"],
        "unknown"
    );
    pool.close().await;
}
