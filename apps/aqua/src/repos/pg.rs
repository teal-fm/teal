use sqlx::PgPool;

use super::DataSource;

pub struct PgDataSource {
    pub db: PgPool,
}

impl PgDataSource {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }
}

// lol
impl DataSource for PgDataSource {}
