use sqlx::PgPool;

use super::{DataSource, music::cache::MusicBrainzCache};

pub struct PgDataSource {
    pub db: PgPool,
    pub(crate) musicbrainz: MusicBrainzCache,
}

impl PgDataSource {
    pub fn new(db: PgPool) -> Self {
        Self {
            db,
            musicbrainz: MusicBrainzCache::default(),
        }
    }
}

// lol
impl DataSource for PgDataSource {}
