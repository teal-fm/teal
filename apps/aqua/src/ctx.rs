use std::sync::Arc;

use crate::repos::DataSource;

/// The raw context struct, used only to build the wrapped Context.
pub struct RawContext {
    pub db: Box<dyn DataSource>, // Boxed trait object with thread safety traits
}

/// The wrapped context, which is shared between all handlers.
pub type Context = Arc<RawContext>;

impl RawContext {
    pub fn new(db: Box<dyn DataSource>) -> Self {
        Self { db }
    }
    // TODO add db/storage/redis
    pub fn build(self) -> Context {
        Arc::new(self)
    }
}
