//! 真实 MCP 协议往返测试：把 `em-use-collab-mcp` 当成真实子进程跑起来，用
//! rmcp 的客户端能力做一次 initialize / list_tools / call_tool，而不是只测
//! `CollabClient` 内部函数；再用同一个状态文件跑一次 `em-use-collab-cli`，
//! 验证两个二进制确实共用同一套绑定身份（设计文档 6.1 节结尾的「共用鉴权与
//! 数据模型」不是只停留在注释里）。
//!
//! 协作服务端本身跑在这个测试进程里（同一个 tokio runtime，绑定到系统分配的
//! 空闲端口），不需要提前手动启动——这样测试是自包含、可重复执行的。

use std::process::Stdio;
use tokio::io::AsyncWriteExt;

use em_use_collaboration_server::{app, db, state::AppState};
use rmcp::{
    model::CallToolRequestParam,
    transport::{ConfigureCommandExt, TokioChildProcess},
    ServiceExt,
};
use serde_json::{json, Value};

async fn start_test_server() -> (String, sqlx::PgPool) {
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

    let router = app(AppState { pool: pool.clone() });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind ephemeral port");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        axum::serve(listener, router).await.ok();
    });
    (format!("http://{addr}"), pool)
}

async fn bootstrap_room_and_bind_code(server_url: &str) -> (String, String, String) {
    let http = reqwest::Client::new();
    let resp: Value = http
        .post(format!("{server_url}/v1/auth/bootstrap"))
        .json(&json!({"username": "alice", "password": "passw0rd!", "display_name": "alice"}))
        .send()
        .await
        .expect("bootstrap request")
        .json()
        .await
        .expect("bootstrap json");
    let session_token = resp["session_token"]
        .as_str()
        .expect("session_token")
        .to_string();

    let room: Value = http
        .post(format!("{server_url}/v1/rooms"))
        .bearer_auth(&session_token)
        .json(&json!({"name": "demo"}))
        .send()
        .await
        .expect("create room request")
        .json()
        .await
        .expect("create room json");
    let room_id = room["id"].as_str().expect("room id").to_string();

    let code: Value = http
        .post(format!("{server_url}/v1/rooms/{room_id}/agent-bind-codes"))
        .bearer_auth(&session_token)
        .json(&json!({}))
        .send()
        .await
        .expect("bind code request")
        .json()
        .await
        .expect("bind code json");
    (
        code["bind_code"].as_str().expect("bind_code").to_string(),
        session_token,
        room_id,
    )
}

#[tokio::test]
async fn mcp_and_cli_round_trip_against_real_server() {
    let (server_url, pool) = start_test_server().await;
    let (bind_code, human_token, room_id) = bootstrap_room_and_bind_code(&server_url).await;

    let state_file = std::env::temp_dir().join(format!(
        "em-use-collab-mcp-test-{}.json",
        uuid_like_suffix()
    ));
    let _ = std::fs::remove_file(&state_file);

    // ---- 1. 真实 MCP 子进程：initialize / list_tools / call_tool ----
    let mcp_bin = env!("CARGO_BIN_EXE_em-use-collab-mcp");
    async fn desktop(
        mcp_bin: &str,
        server: &str,
        state: &std::path::Path,
        input: Value,
    ) -> std::process::Output {
        let mut child = tokio::process::Command::new(mcp_bin)
            .arg("--desktop-command")
            .env("EM_USE_SERVER_URL", server)
            .env("EM_USE_STATE_FILE", state)
            .env("EM_USE_CREDENTIAL_STORE", "file")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(input.to_string().as_bytes())
            .await
            .unwrap();
        child.wait_with_output().await.unwrap()
    }
    let bound = desktop(
        mcp_bin,
        &server_url,
        &state_file,
        json!({"action":"bind","bind_code":bind_code,"host_kind":"dsh","label":"DSH via MCP"}),
    )
    .await;
    assert!(bound.status.success());
    let output = String::from_utf8(bound.stdout).unwrap();
    assert!(!output.contains(&bind_code));
    assert!(!output.contains("agent_token"));
    let bound: Value = serde_json::from_str(&output).unwrap();
    let good = desktop(
        mcp_bin,
        &server_url,
        &state_file,
        json!({"action":"probe","agent_id":bound["result"]["agent_instance_id"],"room_id":room_id}),
    )
    .await;
    assert!(good.status.success());
    let bad = desktop(
        mcp_bin,
        &server_url,
        &state_file,
        json!({"action":"probe","agent_id":"wrong-identity","room_id":room_id}),
    )
    .await;
    assert!(!bad.status.success());
    assert!(!String::from_utf8(bad.stdout).unwrap().contains(&bind_code));
    // A fresh MCP process must recover the identity created by desktop mode.
    let transport =
        TokioChildProcess::new(tokio::process::Command::new(mcp_bin).configure(|cmd| {
            cmd.env("EM_USE_SERVER_URL", &server_url)
                .env("EM_USE_STATE_FILE", &state_file)
                .env("EM_USE_CREDENTIAL_STORE", "file")
                .stderr(Stdio::null());
        }))
        .expect("spawn mcp child process");

    let client = ().serve(transport).await.expect("mcp client handshake");

    let tools = client.list_all_tools().await.expect("list_all_tools");
    let tool_names: Vec<&str> = tools.iter().map(|t| t.name.as_ref()).collect();
    for expected in [
        "agent_bind",
        "room_read",
        "room_ack",
        "room_send",
        "context_get",
        "task_list",
        "task_claim",
        "task_start",
        "task_update",
        "artifact_submit",
        "artifact_read",
        "run_get",
    ] {
        assert!(
            tool_names.contains(&expected),
            "工具列表里应该有 {expected}，实际是 {tool_names:?}"
        );
    }
    // review_task 是人的界面操作，设计文档明确第一版不开放给 Agent，这里顺手
    // 确认没有不小心暴露出去。
    assert!(!tool_names.contains(&"review_task"));

    let mut bind_args = serde_json::Map::new();
    bind_args.insert("bind_code".into(), json!(bind_code));
    bind_args.insert("host_kind".into(), json!("dsh"));
    bind_args.insert("label".into(), json!("DSH via MCP"));
    let bind_result = client
        .call_tool(CallToolRequestParam {
            name: "agent_bind".into(),
            arguments: Some(bind_args),
        })
        .await
        .expect("call agent_bind");
    assert_ne!(bind_result.is_error, Some(true), "{bind_result:?}");
    let bind_text = tool_text(&bind_result);
    let bind_value: Value = serde_json::from_str(&bind_text).expect("bind json");
    assert!(bind_value["agent_instance_id"].as_str().is_some());

    let http = reqwest::Client::new();
    assert!(http
        .patch(format!(
            "{server_url}/v1/agents/{}",
            bind_value["agent_instance_id"].as_str().unwrap()
        ))
        .bearer_auth(&human_token)
        .json(&json!({"auto_reply_enabled":true}))
        .send()
        .await
        .unwrap()
        .status()
        .is_success());
    let seed: Value = http
        .post(format!("{server_url}/v1/rooms/{room_id}/messages"))
        .bearer_auth(&human_token)
        .json(&json!({"body":"hello agent","idempotency_key":"human-seed"}))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let mut send_args = serde_json::Map::new();
    send_args.insert("reply_to_id".into(), seed["id"].clone());
    send_args.insert("body".into(), json!("通过 MCP 工具打的招呼"));
    send_args.insert("idempotency_key".into(), json!("mcp-hello-1"));
    let send_result = client
        .call_tool(CallToolRequestParam {
            name: "room_send".into(),
            arguments: Some(send_args),
        })
        .await
        .expect("call room_send");
    assert_ne!(send_result.is_error, Some(true), "{send_result:?}");

    let read_args = serde_json::Map::new();
    let read_result = client
        .call_tool(CallToolRequestParam {
            name: "room_read".into(),
            arguments: Some(read_args),
        })
        .await
        .expect("call room_read");
    assert_ne!(read_result.is_error, Some(true), "{read_result:?}");
    let read_text = tool_text(&read_result);
    let read_value: Value = serde_json::from_str(&read_text).expect("room_read json");
    let messages = read_value.as_array().expect("messages array");
    assert!(
        messages
            .iter()
            .any(|m| m["body"] == "通过 MCP 工具打的招呼"),
        "room_read 应该能读到刚才通过 room_send 发的那条消息: {messages:?}"
    );

    macro_rules! tool_json {
        ($name:literal, $args:expr) => {{
            let result = client
                .call_tool(CallToolRequestParam {
                    name: $name.into(),
                    arguments: Some($args.as_object().unwrap().clone()),
                })
                .await
                .expect($name);
            assert_ne!(result.is_error, Some(true));
            serde_json::from_str::<Value>(&tool_text(&result)).unwrap()
        }};
    }
    let task:Value=http.post(format!("{server_url}/v1/rooms/{room_id}/tasks")).bearer_auth(&human_token).json(&json!({"title":"MCP task","description":"read project","acceptance_criteria":"text evidence","assignment_mode":"open"})).send().await.unwrap().json().await.unwrap();
    let claimed = tool_json!(
        "task_claim",
        json!({"task_id":task["id"],"expected_version":task["version"]})
    );
    let permit:Value=http.post(format!("{server_url}/v1/tasks/{}/authorize",task["id"].as_str().unwrap())).bearer_auth(&human_token).json(&json!({"agent_instance_id":bind_value["agent_instance_id"],"expected_version":claimed["version"]})).send().await.unwrap().json().await.unwrap();
    let run = tool_json!(
        "task_start",
        json!({"task_id":task["id"],"idempotency_key":"mcp-run","execution_mode":"user_triggered","authorization_token":permit["authorization_token"]})
    );
    assert_eq!(
        tool_json!("run_get", json!({"run_id":run["id"]}))["status"],
        "running"
    );
    let artifact = tool_json!(
        "artifact_submit",
        json!({"task_id":task["id"],"run_id":run["id"],"kind":"text","content":"MCP evidence","verification_summary":"read-only test"})
    );
    assert_eq!(
        tool_json!(
            "artifact_read",
            json!({"task_id":task["id"],"artifact_id":artifact["id"]})
        )["content"],
        "MCP evidence"
    );
    assert_eq!(
        tool_json!("artifact_read", json!({"task_id":task["id"]}))[0]["id"],
        artifact["id"]
    );
    assert_eq!(
        tool_json!("run_get", json!({"run_id":run["id"]}))["status"],
        "succeeded"
    );

    client.cancel().await.expect("cancel mcp client");

    // ---- 2. 轻量 CLI：用同一个状态文件，证明两个二进制真的共用绑定身份 ----
    let cli_bin = env!("CARGO_BIN_EXE_em-use-collab-cli");
    let output = tokio::process::Command::new(cli_bin)
        .arg("task-list")
        .env("EM_USE_SERVER_URL", &server_url)
        .env("EM_USE_STATE_FILE", &state_file)
        .env("EM_USE_CREDENTIAL_STORE", "file")
        .output()
        .await
        .expect("run cli task-list");
    assert!(
        output.status.success(),
        "cli task-list 应该成功退出: stderr={}",
        String::from_utf8_lossy(&output.stderr)
    );
    let tasks: Value =
        serde_json::from_slice(&output.stdout).expect("cli task-list 输出应该是合法 JSON");
    assert!(
        tasks.as_array().is_some(),
        "task-list 应该返回数组: {tasks:?}"
    );

    // Binding conflicts must be explicit; changing origins must fail before transmitting credentials.
    let conflict = tokio::process::Command::new(cli_bin)
        .args(["bind", "another-code", "codex", "another-agent"])
        .env("EM_USE_SERVER_URL", &server_url)
        .env("EM_USE_STATE_FILE", &state_file)
        .env("EM_USE_CREDENTIAL_STORE", "file")
        .output()
        .await
        .unwrap();
    assert!(!conflict.status.success());
    assert!(String::from_utf8_lossy(&conflict.stderr).contains("profile"));
    let wrong_origin = tokio::process::Command::new(cli_bin)
        .arg("task-list")
        .env("EM_USE_SERVER_URL", "http://127.0.0.1:1")
        .env("EM_USE_STATE_FILE", &state_file)
        .env("EM_USE_CREDENTIAL_STORE", "file")
        .output()
        .await
        .unwrap();
    assert!(!wrong_origin.status.success());
    assert!(String::from_utf8_lossy(&wrong_origin.stderr).contains("其他服务端"));
    let metadata: Value = serde_json::from_slice(&std::fs::read(&state_file).unwrap()).unwrap();
    assert!(metadata["identity"].get("agent_token").is_none());
    let state2 = state_file.with_file_name(format!(
        "second-{}",
        state_file.file_name().unwrap().to_string_lossy()
    ));
    let second_code: Value = http
        .post(format!("{server_url}/v1/rooms/{room_id}/agent-bind-codes"))
        .bearer_auth(&human_token)
        .json(&json!({}))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let second = tokio::process::Command::new(cli_bin)
        .args([
            "bind",
            second_code["bind_code"].as_str().unwrap(),
            "codex",
            "second",
        ])
        .env("EM_USE_SERVER_URL", &server_url)
        .env("EM_USE_STATE_FILE", &state2)
        .env("EM_USE_CREDENTIAL_STORE", "file")
        .output()
        .await
        .unwrap();
    assert!(
        second.status.success(),
        "{}",
        String::from_utf8_lossy(&second.stderr)
    );
    let second: Value = serde_json::from_slice(&second.stdout).unwrap();
    assert_ne!(second["agent_instance_id"], bind_value["agent_instance_id"]);
    for path in [
        &state2,
        &std::path::PathBuf::from(format!("{}.credential", state2.display())),
        &std::path::PathBuf::from(format!("{}.lock", state2.display())),
    ] {
        let _ = std::fs::remove_file(path);
    }

    let _ = std::fs::remove_file(&state_file);
    let _ = std::fs::remove_file(std::path::PathBuf::from(format!(
        "{}.credential",
        state_file.display()
    )));
    let _ = std::fs::remove_file(std::path::PathBuf::from(format!(
        "{}.lock",
        state_file.display()
    )));
    pool.close().await;
}

fn tool_text(result: &rmcp::model::CallToolResult) -> String {
    result
        .content
        .first()
        .and_then(|c| c.as_text())
        .map(|t| t.text.clone())
        .unwrap_or_default()
}

fn uuid_like_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{nanos}-{}", std::process::id())
}
