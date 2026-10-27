//! 集成测试：直接对内存中的 axum Router 发请求（不起真实 TCP 监听），
//! 但使用一个真实的本机 PostgreSQL 测试库，覆盖设计文档 11.2 节的关键场景：
//! 权限拒绝、幂等、并发单活跃 Run、乐观并发版本冲突、验收退回。
//!
//! 运行前需要：
//!   createdb em_use_collab_test_local
//!   export EM_USE_TEST_DATABASE_URL=postgres://localhost/em_use_collab_test_local
//!   cargo test

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
    // 每次测试运行前清空所有表，保持测试可重复执行。
    sqlx::query(
        "TRUNCATE users, invites, sessions, devices, rooms, room_counters, memberships, \
         context_versions, messages, tasks, runs, artifacts, reviews, room_events CASCADE",
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

#[tokio::test]
async fn end_to_end_room_task_lifecycle_and_edge_cases() {
    let pool = test_pool().await;
    let router = app(AppState { pool: pool.clone() });

    // ---- 1. bootstrap 只能在空库时用一次 ----
    let (status, alice_auth) = call(
        &router,
        Method::POST,
        "/v1/auth/bootstrap",
        None,
        Some(json!({"username":"alice","password":"passw0rd!","display_name":"Alice"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{alice_auth:?}");
    let alice_token = s(&alice_auth, "session_token");
    assert!(alice_auth["user"]["is_admin"].as_bool().unwrap());

    let (status, _) = call(
        &router,
        Method::POST,
        "/v1/auth/bootstrap",
        None,
        Some(json!({"username":"mallory","password":"passw0rd!","display_name":"Mallory"})),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "第二次 bootstrap 必须被拒绝");

    // ---- 2. 未认证 / 伪造令牌必须被拒绝 ----
    let (status, _) = call(&router, Method::GET, "/v1/rooms", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let (status, _) = call(&router, Method::GET, "/v1/rooms", Some("sess_forged"), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    // ---- 3. 邀请注册：一次性令牌 ----
    let (status, invite) = call(
        &router,
        Method::POST,
        "/v1/auth/invites",
        Some(&alice_token),
        Some(json!({"note": "bob"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let invite_token = s(&invite, "invite_token");

    let (status, bob_auth) = call(
        &router,
        Method::POST,
        "/v1/auth/register",
        None,
        Some(json!({
            "invite_token": invite_token,
            "username": "bob",
            "password": "passw0rd!",
            "display_name": "Bob",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{bob_auth:?}");
    let bob_token = s(&bob_auth, "session_token");
    let bob_id = s(&bob_auth["user"], "id");

    // 同一个邀请令牌不能用第二次。
    let (status, _) = call(
        &router,
        Method::POST,
        "/v1/auth/register",
        None,
        Some(json!({
            "invite_token": invite_token,
            "username": "bob2",
            "password": "passw0rd!",
            "display_name": "Bob2",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "邀请不能重复使用");

    // 非管理员不能发邀请。
    let (status, _) = call(
        &router,
        Method::POST,
        "/v1/auth/invites",
        Some(&bob_token),
        Some(json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "非管理员不能创建邀请");

    // ---- 4. 创建房间、加入成员、非成员读取被拒绝 ----
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
        Method::GET,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_token),
        None,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "尚未加入房间的用户不能读取消息"
    );

    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/members"),
        Some(&alice_token),
        Some(json!({"username": "bob"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // ---- 5. 消息幂等发送：相同 idempotency_key 不会产生第二条消息 ----
    async fn send_message(
        router: &Router,
        room_id: &str,
        token: &str,
        key: &str,
    ) -> (StatusCode, Value) {
        call(
            router,
            Method::POST,
            &format!("/v1/rooms/{room_id}/messages"),
            Some(token),
            Some(json!({"body": "hello bob", "idempotency_key": key})),
        )
        .await
    }
    let (status, msg1) = send_message(&router, &room_id, &alice_token, "m1").await;
    assert_eq!(status, StatusCode::OK);
    let (status, msg2) = send_message(&router, &room_id, &alice_token, "m1").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(msg1["id"], msg2["id"], "相同幂等键必须返回同一条消息");

    let (status, list) = call(
        &router,
        Method::GET,
        &format!("/v1/rooms/{room_id}/messages?after_seq=0"),
        Some(&bob_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        list.as_array().unwrap().len(),
        1,
        "不能因为重放产生重复消息"
    );

    // ---- 6. 任务：指定负责人、版本冲突、原子领取 ----
    let (status, task) = call(
        &router,
        Method::POST,
        &format!("/v1/rooms/{room_id}/tasks"),
        Some(&alice_token),
        Some(json!({
            "title": "修复接口",
            "description": "分析报错",
            "acceptance_criteria": "接口返回 200",
            "assignment_mode": "directed",
            "target_username": "bob",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{task:?}");
    let task_id = s(&task, "id");

    // 错误版本号必须被拒绝（乐观并发）。
    let (status, conflict) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/claim"),
        Some(&bob_token),
        Some(json!({"expected_version": 999})),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{conflict:?}");

    let (status, claimed) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/claim"),
        Some(&bob_token),
        Some(json!({"expected_version": 1})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{claimed:?}");
    assert_eq!(claimed["status"], "claimed");
    assert_eq!(claimed["assignee_user_id"].as_str(), Some(bob_id.as_str()));

    // 房主不能代替 Agent 所有者执行其本机绑定——这里体现为“非负责人不能启动”。
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/start"),
        Some(&alice_token),
        Some(json!({"idempotency_key": "run-by-alice", "execution_mode": "user_triggered"})),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "房主不能代替负责人启动执行");

    // ---- 7. 并发启动同一任务两次 Run：只能有一个成功 ----
    async fn start_run(
        router: &Router,
        task_id: &str,
        token: &str,
        key: &str,
    ) -> (StatusCode, Value) {
        call(
            router,
            Method::POST,
            &format!("/v1/tasks/{task_id}/start"),
            Some(token),
            Some(json!({"idempotency_key": key, "execution_mode": "user_triggered"})),
        )
        .await
    }
    let (r1, r2) = tokio::join!(
        start_run(&router, &task_id, &bob_token, "run-a"),
        start_run(&router, &task_id, &bob_token, "run-b")
    );
    let statuses = [r1.0, r2.0];
    let ok_count = statuses.iter().filter(|s| **s == StatusCode::OK).count();
    let conflict_count = statuses
        .iter()
        .filter(|s| **s == StatusCode::CONFLICT)
        .count();
    assert_eq!(
        ok_count, 1,
        "两个不同幂等键并发启动，只能有一个成功创建 Run: {statuses:?}"
    );
    assert_eq!(
        conflict_count, 1,
        "另一个必须被数据库唯一索引拒绝: {statuses:?}"
    );

    let run = if r1.0 == StatusCode::OK { r1.1 } else { r2.1 };
    let run_id = s(&run, "id");

    // 相同幂等键重复调用 start 必须返回同一个 Run，而不是报错或建第二个。
    // 用哪个 future 实际赢得了竞争来判定键，不能用 run_generation 推断
    // （本任务的首个 Run 永远是第 1 代，两个候选键谁赢都一样）。
    let winning_key = if r1.0 == StatusCode::OK {
        "run-a"
    } else {
        "run-b"
    };
    let (status, run_again) = start_run(&router, &task_id, &bob_token, winning_key).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        run_again["id"], run["id"],
        "相同幂等键必须幂等返回同一个 Run"
    );

    // ---- 8. 提交成果 → 待验收 → 验收退回 → 必须重新启动新 Run ----
    let (status, artifact) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/artifact"),
        Some(&bob_token),
        Some(json!({
            "run_id": run_id,
            "kind": "markdown",
            "content": "修复完成",
            "verification_summary": "本地测试通过，未做原生验证",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{artifact:?}");

    let (status, rejected_task) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/review"),
        Some(&alice_token),
        Some(json!({"decision": "rejected", "reason": "缺少异常处理"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        rejected_task["status"], "claimed",
        "退回必须回到已接单，等待重新启动"
    );

    // 旧 Run 已结束，不能再用旧 run_id 提交成果冒充新尝试。
    let (status, _) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/artifact"),
        Some(&bob_token),
        Some(json!({
            "run_id": run_id,
            "kind": "markdown",
            "content": "再次提交",
            "verification_summary": "重复提交测试",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "旧 Run 不能再提交成果");

    // 必须显式启动新一轮才能重新提交，新 Run 的 run_generation 必须递增。
    let (status, run2) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/start"),
        Some(&bob_token),
        Some(json!({"idempotency_key": "run-c", "execution_mode": "user_triggered"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{run2:?}");
    assert_eq!(
        run2["run_generation"], 2,
        "run_generation 必须严格递增，不能复用"
    );

    let (status, artifact2) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/artifact"),
        Some(&bob_token),
        Some(json!({
            "run_id": run2["id"],
            "kind": "markdown",
            "content": "修复完成 v2",
            "verification_summary": "本地测试通过",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{artifact2:?}");

    let (status, accepted_task) = call(
        &router,
        Method::POST,
        &format!("/v1/tasks/{task_id}/review"),
        Some(&alice_token),
        Some(json!({"decision": "accepted"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(accepted_task["status"], "completed");

    // ---- 9. 事件日志必须严格按房间递增序号可恢复读取，不漏不重 ----
    let (status, events) = call(
        &router,
        Method::GET,
        &format!("/v1/rooms/{room_id}/events?after_seq=0"),
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let events = events.as_array().unwrap();
    let seqs: Vec<i64> = events.iter().map(|e| e["seq"].as_i64().unwrap()).collect();
    let mut sorted = seqs.clone();
    sorted.sort();
    sorted.dedup();
    assert_eq!(seqs, sorted, "序号必须严格递增且不重复");

    // 从中间断点补拉，必须拿到剩余事件，不多不少。
    let midpoint = seqs[seqs.len() / 2];
    let (status, resumed) = call(
        &router,
        Method::GET,
        &format!("/v1/rooms/{room_id}/events?after_seq={midpoint}"),
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let resumed_count = resumed.as_array().unwrap().len();
    let expected_count = seqs.iter().filter(|&&seq| seq > midpoint).count();
    assert_eq!(resumed_count, expected_count, "断线补拉必须精确覆盖缺口");

    // ---- 10. 移除成员后立即拒绝后续访问 ----
    let (status, _) = call(
        &router,
        Method::DELETE,
        &format!("/v1/rooms/{room_id}/members/{bob_id}"),
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = call(
        &router,
        Method::GET,
        &format!("/v1/rooms/{room_id}/messages"),
        Some(&bob_token),
        None,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "移除成员后必须立即拒绝后续访问"
    );

    // ---- 11. 设备撤销立即失效 ----
    let (status, device) = call(
        &router,
        Method::POST,
        "/v1/auth/devices",
        Some(&alice_token),
        Some(json!({"name": "alice-desktop"})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let device_token = s(&device, "device_token");
    let device_id = s(&device, "device_id");

    let (status, _) = call(&router, Method::GET, "/v1/rooms", Some(&device_token), None).await;
    assert_eq!(status, StatusCode::OK, "设备令牌应当可以正常访问");

    let (status, _) = call(
        &router,
        Method::DELETE,
        &format!("/v1/auth/devices/{device_id}"),
        Some(&alice_token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, _) = call(&router, Method::GET, "/v1/rooms", Some(&device_token), None).await;
    assert_eq!(
        status,
        StatusCode::UNAUTHORIZED,
        "撤销后的设备令牌必须立即失效"
    );

    pool.close().await;
}
