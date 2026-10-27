pub mod auth;
pub mod db;
pub mod error;
pub mod handlers;
pub mod models;
pub mod room_log;
pub mod state;

use axum::{
    routing::{delete, get, post},
    Router,
};
use tower_http::trace::TraceLayer;

use state::AppState;

pub fn app(state: AppState) -> Router {
    let auth_routes = Router::new()
        .route("/me", get(handlers::auth::me))
        .route("/bootstrap", post(handlers::auth::bootstrap))
        .route("/invites", post(handlers::auth::create_invite))
        .route("/register", post(handlers::auth::register))
        .route("/login", post(handlers::auth::login))
        .route("/logout", post(handlers::auth::logout))
        .route("/devices", post(handlers::auth::create_device))
        .route("/devices/:device_id", delete(handlers::auth::revoke_device));

    let room_routes = Router::new()
        .route(
            "/",
            post(handlers::rooms::create_room).get(handlers::rooms::list_rooms),
        )
        .route(
            "/:room_id/members",
            get(handlers::rooms::list_members).post(handlers::rooms::add_member),
        )
        .route(
            "/:room_id/members/:user_id",
            delete(handlers::rooms::remove_member),
        )
        .route("/:room_id/archive", post(handlers::rooms::archive_room))
        .route(
            "/:room_id/messages",
            get(handlers::messages::list_messages).post(handlers::messages::send_message),
        )
        .route(
            "/:room_id/context",
            get(handlers::context::get_context).put(handlers::context::update_context),
        )
        .route(
            "/:room_id/tasks",
            get(handlers::tasks::list_tasks).post(handlers::tasks::create_task),
        )
        .route("/:room_id/events", get(handlers::events::list_events))
        .route(
            "/:room_id/agent-bind-codes",
            post(handlers::agents::create_bind_code),
        )
        .route("/:room_id/agents", get(handlers::agents::list_room_agents));

    let task_routes = Router::new()
        .route("/:task_id/claim", post(handlers::tasks::claim_task))
        .route("/:task_id/start", post(handlers::tasks::start_run))
        .route("/:task_id/authorize", post(handlers::tasks::authorize_task))
        .route(
            "/:task_id/artifact",
            post(handlers::tasks::submit_artifact).get(handlers::tasks::list_artifacts),
        )
        .route(
            "/:task_id/artifact/:artifact_id",
            get(handlers::tasks::get_artifact),
        )
        .route("/:task_id/review", post(handlers::tasks::review_task));

    let run_routes = Router::new()
        .route("/:run_id", get(handlers::tasks::get_run))
        .route("/:run_id/resolve", post(handlers::tasks::resolve_run))
        .route("/:run_id/update", post(handlers::tasks::update_run))
        .route("/:run_id/cancel", post(handlers::tasks::cancel_run));

    let agent_routes = Router::new()
        .route("/bind", post(handlers::agents::bind_agent))
        .route(
            "/:agent_id",
            get(handlers::agents::get_agent_self)
                .patch(handlers::agents::update_agent)
                .delete(handlers::agents::revoke_agent),
        )
        .route("/:agent_id/heartbeat", post(handlers::agents::heartbeat))
        .route("/:agent_id/ack", post(handlers::agents::ack))
        .route(
            "/:agent_id/grants",
            get(handlers::grants::list_grants).post(handlers::grants::create_grant),
        );

    let grant_routes = Router::new().route("/:grant_id", delete(handlers::grants::revoke_grant));

    Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .nest("/v1/auth", auth_routes)
        .nest("/v1/rooms", room_routes)
        .nest("/v1/tasks", task_routes)
        .nest("/v1/runs", run_routes)
        .nest("/v1/agents", agent_routes)
        .nest("/v1/grants", grant_routes)
        .layer(axum::extract::DefaultBodyLimit::max(12 * 1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
