use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use jacquard_common::IntoStatic;
use serde::{Deserialize, Serialize};
use types::fm_teal::alpha::feed::PlayView;
use types::fm_teal::alpha::music::{AlbumView, ArtistView};

use crate::ctx::Context;

pub fn music_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.alpha.music.getArtist", get(get_artist))
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
