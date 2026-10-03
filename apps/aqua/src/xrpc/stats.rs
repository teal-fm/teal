use types::fm_teal::stats::get_latest::GetLatestOutput;
use types::fm_teal::stats::get_top_artists::GetTopArtistsOutput;
use types::fm_teal::stats::get_top_releases::GetTopReleasesOutput;
use types::fm_teal::stats::get_user_top_artists::GetUserTopArtistsOutput;
use types::fm_teal::stats::get_user_top_recordings::GetUserTopRecordingsOutput;
use types::fm_teal::stats::get_user_top_releases::GetUserTopReleasesOutput;
mod repo_chart;

use crate::ctx::Context;
use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use jacquard_common::IntoStatic;
use serde::Deserialize;

// mount stats routes
pub fn stats_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.stats.getTopArtists", get(get_top_artists))
        .route("/fm.teal.stats.getTopReleases", get(get_top_releases))
        .route(
            "/fm.teal.stats.getUserTopArtists",
            get(get_user_top_artists),
        )
        .route(
            "/fm.teal.stats.getUserTopReleases",
            get(get_user_top_releases),
        )
        .route(
            "/fm.teal.stats.getRepoTopReleases",
            get(repo_chart::get_repo_top_releases),
        )
        .route(
            "/fm.teal.stats.getUserTopRecordings",
            get(get_user_top_recordings),
        )
        .route("/fm.teal.stats.getLatest", get(get_latest))
}

#[derive(Deserialize)]
pub struct GetTopArtistsQuery {
    pub limit: Option<i32>,
}

pub async fn get_top_artists(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetTopArtistsQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;

    match repo.get_top_artists(query.limit).await {
        Ok(artists) => Ok(axum::Json(GetTopArtistsOutput {
            cursor: None,
            extra_data: Default::default(),
            artists: artists.into_static(),
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetTopReleasesQuery {
    pub limit: Option<i32>,
}

pub async fn get_top_releases(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetTopReleasesQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;

    match repo.get_top_releases(query.limit).await {
        Ok(releases) => Ok(axum::Json(GetTopReleasesOutput {
            cursor: None,
            extra_data: Default::default(),
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
        Ok(page) => Ok(axum::Json(GetUserTopRecordingsOutput {
            extra_data: Default::default(),
            recordings: page.recordings.into_static(),
            cursor: page.cursor.map(Into::into),
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
        Ok(page) => Ok(axum::Json(GetUserTopArtistsOutput {
            extra_data: Default::default(),
            artists: page.artists.into_static(),
            cursor: page.cursor.map(Into::into),
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
        Ok(page) => Ok(axum::Json(GetUserTopReleasesOutput {
            extra_data: Default::default(),
            releases: page.releases.into_static(),
            cursor: page.cursor.map(Into::into),
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

pub async fn get_latest(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetLatestQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;

    match repo.get_latest(query.limit, query.cursor.as_deref()).await {
        Ok(page) => Ok(axum::Json(GetLatestOutput {
            extra_data: Default::default(),
            plays: page.plays.into_static(),
            cursor: page.cursor.map(Into::into),
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
