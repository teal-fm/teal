use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use jacquard_common::IntoStatic;
use serde::Deserialize;
use types::fm_teal::music::get_album::GetAlbumOutput;
use types::fm_teal::music::get_artist::GetArtistOutput;
use types::fm_teal::music::get_artist_listeners::GetArtistListenersOutput;
use types::fm_teal::music::get_release_group::GetReleaseGroupOutput;

use crate::ctx::Context;

pub fn music_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.music.getArtist", get(get_artist))
        .route(
            "/fm.teal.music.getArtistListeners",
            get(get_artist_listeners),
        )
        .route("/fm.teal.music.getAlbum", get(get_album))
        .route("/fm.teal.music.getReleaseGroup", get(get_release_group))
}

#[derive(Deserialize)]
pub struct GetArtistQuery {
    pub mbid: Option<String>,
    pub name: Option<String>,
}

pub async fn get_artist(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetArtistQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if query.mbid.is_none() && query.name.as_deref().is_none_or(str::is_empty) {
        return Err((
            StatusCode::BAD_REQUEST,
            "mbid or name is required".to_string(),
        ));
    }

    match ctx
        .db
        .get_artist(query.mbid.as_deref(), query.name.as_deref())
        .await
    {
        Ok(artist) => Ok(axum::Json(GetArtistOutput {
            extra_data: Default::default(),
            artist: artist.into_static(),
        })),
        Err(error) if error.to_string() == "artist not found" => {
            Err((StatusCode::NOT_FOUND, error.to_string()))
        }
        Err(error) => Err((StatusCode::INTERNAL_SERVER_ERROR, error.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetArtistListenersQuery {
    pub mbid: Option<String>,
    pub name: Option<String>,
    pub period: Option<String>,
    pub limit: Option<i32>,
    pub cursor: Option<String>,
}

pub async fn get_artist_listeners(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetArtistListenersQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if query.mbid.is_none() && query.name.as_deref().is_none_or(str::is_empty) {
        return Err((
            StatusCode::BAD_REQUEST,
            "mbid or name is required".to_string(),
        ));
    }

    match ctx
        .db
        .get_artist_listeners(
            query.mbid.as_deref(),
            query.name.as_deref(),
            query.period.as_deref(),
            query.limit,
            query.cursor.as_deref(),
        )
        .await
    {
        Ok(page) => Ok(axum::Json(GetArtistListenersOutput {
            extra_data: Default::default(),
            listeners: page.listeners.into_static(),
            cursor: page.cursor.map(Into::into),
        })),
        Err(error) if error.to_string() == "artist not found" => {
            Err((StatusCode::NOT_FOUND, error.to_string()))
        }
        Err(error) if error.to_string().starts_with("unsupported period:") => {
            Err((StatusCode::BAD_REQUEST, error.to_string()))
        }
        Err(error) => Err((StatusCode::INTERNAL_SERVER_ERROR, error.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetAlbumQuery {
    pub mbid: String,
    pub limit: Option<i32>,
    pub cursor: Option<String>,
}

pub async fn get_album(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetAlbumQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if query.mbid.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "mbid is required".to_string()));
    }

    match ctx
        .db
        .get_album(&query.mbid, query.limit, query.cursor.as_deref())
        .await
    {
        Ok(page) => Ok(axum::Json(GetAlbumOutput {
            extra_data: Default::default(),
            album: page.album.into_static(),
            plays: page.plays.into_static(),
            cursor: page.cursor.map(Into::into),
        })),
        Err(error) if error.to_string() == "album not found" => {
            Err((StatusCode::NOT_FOUND, error.to_string()))
        }
        Err(error) => Err((StatusCode::INTERNAL_SERVER_ERROR, error.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetReleaseGroupQuery {
    pub mbid: String,
}

pub async fn get_release_group(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetReleaseGroupQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if uuid::Uuid::parse_str(query.mbid.strip_prefix("mbid:").unwrap_or(&query.mbid)).is_err() {
        return Err((
            StatusCode::BAD_REQUEST,
            "mbid must be a MusicBrainz release UUID".to_string(),
        ));
    }
    match ctx.db.get_release_group(&query.mbid).await {
        Ok(release_group_mbid) => Ok(axum::Json(GetReleaseGroupOutput {
            release_group_mbid: release_group_mbid.map(crate::repos::uri_value),
            extra_data: Default::default(),
        })),
        Err(error) => {
            tracing::warn!(%error, "MusicBrainz release-group lookup failed");
            Err((
                StatusCode::SERVICE_UNAVAILABLE,
                "MusicBrainz metadata unavailable; retry later".to_string(),
            ))
        }
    }
}
