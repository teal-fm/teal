use crate::ctx::Context;
use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use serde::{Deserialize, Serialize};
use types::fm::teal::alpha::stats::defs::{ArtistViewData, ReleaseViewData};
use types::fm::teal::alpha::feed::defs::PlayViewData;

// mount stats routes
pub fn stats_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.alpha.stats.getTopArtists", get(get_top_artists))
        .route("/fm.teal.alpha.stats.getTopReleases", get(get_top_releases))
        .route("/fm.teal.alpha.stats.getUserTopArtists", get(get_user_top_artists))
        .route("/fm.teal.alpha.stats.getUserTopReleases", get(get_user_top_releases))
        .route("/fm.teal.alpha.stats.getLatest", get(get_latest))
}

#[derive(Deserialize)]
pub struct GetTopArtistsQuery {
    pub limit: Option<i32>,
}

#[derive(Serialize)]
pub struct GetTopArtistsResponse {
    artists: Vec<ArtistViewData>,
}

pub async fn get_top_artists(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetTopArtistsQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;
    
    match repo.get_top_artists(query.limit).await {
        Ok(artists) => Ok(axum::Json(GetTopArtistsResponse { artists })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetTopReleasesQuery {
    pub limit: Option<i32>,
}

#[derive(Serialize)]
pub struct GetTopReleasesResponse {
    releases: Vec<ReleaseViewData>,
}

pub async fn get_top_releases(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetTopReleasesQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;
    
    match repo.get_top_releases(query.limit).await {
        Ok(releases) => Ok(axum::Json(GetTopReleasesResponse { releases })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetUserTopArtistsQuery {
    pub actor: String,
    pub limit: Option<i32>,
}

#[derive(Serialize)]
pub struct GetUserTopArtistsResponse {
    artists: Vec<ArtistViewData>,
}

pub async fn get_user_top_artists(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetUserTopArtistsQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;
    
    if query.actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }
    
    match repo.get_user_top_artists(&query.actor, query.limit).await {
        Ok(artists) => Ok(axum::Json(GetUserTopArtistsResponse { artists })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetUserTopReleasesQuery {
    pub actor: String,
    pub limit: Option<i32>,
}

#[derive(Serialize)]
pub struct GetUserTopReleasesResponse {
    releases: Vec<ReleaseViewData>,
}

pub async fn get_user_top_releases(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetUserTopReleasesQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;
    
    if query.actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }
    
    match repo.get_user_top_releases(&query.actor, query.limit).await {
        Ok(releases) => Ok(axum::Json(GetUserTopReleasesResponse { releases })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetLatestQuery {
    pub limit: Option<i32>,
}

#[derive(Serialize)]
pub struct GetLatestResponse {
    plays: Vec<PlayViewData>,
}

pub async fn get_latest(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetLatestQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;
    
    match repo.get_latest(query.limit).await {
        Ok(plays) => Ok(axum::Json(GetLatestResponse { plays })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}