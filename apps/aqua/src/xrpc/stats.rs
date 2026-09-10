use crate::ctx::Context;
use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use jacquard_common::IntoStatic;
use serde::{Deserialize, Serialize};
use types::fm_teal::alpha::feed::PlayView;
use types::fm_teal::alpha::stats::{ArtistView, RecordingView, ReleaseView};

// mount stats routes
pub fn stats_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.alpha.stats.getTopArtists", get(get_top_artists))
        .route("/fm.teal.alpha.stats.getTopReleases", get(get_top_releases))
        .route(
            "/fm.teal.alpha.stats.getUserTopArtists",
            get(get_user_top_artists),
        )
        .route(
            "/fm.teal.alpha.stats.getUserTopReleases",
            get(get_user_top_releases),
        )
        .route(
            "/fm.teal.alpha.stats.getUserTopRecordings",
            get(get_user_top_recordings),
        )
        .route("/fm.teal.alpha.stats.getLatest", get(get_latest))
}

#[derive(Deserialize)]
pub struct GetTopArtistsQuery {
    pub limit: Option<i32>,
}

#[derive(Serialize)]
pub struct GetTopArtistsResponse {
    artists: Vec<ArtistView>,
}

pub async fn get_top_artists(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetTopArtistsQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;

    match repo.get_top_artists(query.limit).await {
        Ok(artists) => Ok(axum::Json(GetTopArtistsResponse {
            artists: artists.into_static(),
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetTopReleasesQuery {
    pub limit: Option<i32>,
}

#[derive(Serialize)]
pub struct GetTopReleasesResponse {
    releases: Vec<ReleaseView>,
}

pub async fn get_top_releases(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetTopReleasesQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;

    match repo.get_top_releases(query.limit).await {
        Ok(releases) => Ok(axum::Json(GetTopReleasesResponse {
            releases: releases.into_static(),
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetUserTopRecordingsQuery {
    pub actor: String,
    pub period: Option<String>,
    pub limit: Option<i32>,
    pub cursor: Option<String>,
}

#[derive(Serialize)]
pub struct GetUserTopRecordingsResponse {
    recordings: Vec<RecordingView>,
    cursor: Option<String>,
}

pub async fn get_user_top_recordings(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetUserTopRecordingsQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;

    if query.actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }

    match repo
        .get_user_top_recordings(
            &query.actor,
            query.period.as_deref(),
            query.limit,
            query.cursor.as_deref(),
        )
        .await
    {
        Ok(page) => Ok(axum::Json(GetUserTopRecordingsResponse {
            recordings: page.recordings.into_static(),
            cursor: page.cursor,
        })),
        Err(e) if e.to_string().starts_with("unsupported period:") => {
            Err((StatusCode::BAD_REQUEST, e.to_string()))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetUserTopArtistsQuery {
    pub actor: String,
    pub period: Option<String>,
    pub limit: Option<i32>,
    pub cursor: Option<String>,
}

#[derive(Serialize)]
pub struct GetUserTopArtistsResponse {
    artists: Vec<ArtistView>,
    cursor: Option<String>,
}

pub async fn get_user_top_artists(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetUserTopArtistsQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;

    if query.actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }

    match repo
        .get_user_top_artists(
            &query.actor,
            query.period.as_deref(),
            query.limit,
            query.cursor.as_deref(),
        )
        .await
    {
        Ok(page) => Ok(axum::Json(GetUserTopArtistsResponse {
            artists: page.artists.into_static(),
            cursor: page.cursor,
        })),
        Err(e) if e.to_string().starts_with("unsupported period:") => {
            Err((StatusCode::BAD_REQUEST, e.to_string()))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetUserTopReleasesQuery {
    pub actor: String,
    pub period: Option<String>,
    pub limit: Option<i32>,
    pub cursor: Option<String>,
}

#[derive(Serialize)]
pub struct GetUserTopReleasesResponse {
    releases: Vec<ReleaseView>,
    cursor: Option<String>,
}

pub async fn get_user_top_releases(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetUserTopReleasesQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;

    if query.actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }

    match repo
        .get_user_top_releases(
            &query.actor,
            query.period.as_deref(),
            query.limit,
            query.cursor.as_deref(),
        )
        .await
    {
        Ok(page) => Ok(axum::Json(GetUserTopReleasesResponse {
            releases: page.releases.into_static(),
            cursor: page.cursor,
        })),
        Err(e) if e.to_string().starts_with("unsupported period:") => {
            Err((StatusCode::BAD_REQUEST, e.to_string()))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetLatestQuery {
    pub limit: Option<i32>,
    pub cursor: Option<String>,
}

#[derive(Serialize)]
pub struct GetLatestResponse {
    plays: Vec<PlayView>,
    cursor: Option<String>,
}

pub async fn get_latest(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetLatestQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;

    match repo.get_latest(query.limit, query.cursor.as_deref()).await {
        Ok(page) => Ok(axum::Json(GetLatestResponse {
            plays: page.plays.into_static(),
            cursor: page.cursor,
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
