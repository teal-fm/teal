use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use jacquard_common::IntoStatic;
use serde::{Deserialize, Serialize};
use types::fm_teal::alpha::feed::PlayView;
use types::fm_teal::alpha::music::{AlbumView, ArtistListenerView, ArtistView};

use crate::ctx::Context;

pub fn music_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.alpha.music.getArtist", get(get_artist))
        .route(
            "/fm.teal.alpha.music.getArtistListeners",
            get(get_artist_listeners),
        )
        .route("/fm.teal.alpha.music.getAlbum", get(get_album))
}

#[derive(Deserialize)]
pub struct GetArtistQuery {
    pub mbid: Option<String>,
    pub name: Option<String>,
}

#[derive(Serialize)]
pub struct GetArtistResponse {
    artist: ArtistView,
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
        Ok(artist) => Ok(axum::Json(GetArtistResponse {
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

#[derive(Serialize)]
pub struct GetArtistListenersResponse {
    listeners: Vec<ArtistListenerView>,
    cursor: Option<String>,
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
        Ok(page) => Ok(axum::Json(GetArtistListenersResponse {
            listeners: page.listeners.into_static(),
            cursor: page.cursor,
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

#[derive(Serialize)]
pub struct GetAlbumResponse {
    album: AlbumView,
    plays: Vec<PlayView>,
    cursor: Option<String>,
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
        Ok(page) => Ok(axum::Json(GetAlbumResponse {
            album: page.album.into_static(),
            plays: page.plays.into_static(),
            cursor: page.cursor,
        })),
        Err(error) if error.to_string() == "album not found" => {
            Err((StatusCode::NOT_FOUND, error.to_string()))
        }
        Err(error) => Err((StatusCode::INTERNAL_SERVER_ERROR, error.to_string())),
    }
}
