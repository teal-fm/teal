use std::sync::Arc;

use crate::{identity::ActorResolver, repos::DataSource};

/// The raw context struct, used only to build the wrapped Context.
pub struct RawContext {
    pub db: Box<dyn DataSource>, // Boxed trait object with thread safety traits
    /// Looks up accounts that have no indexed profile yet.
    pub actors: Arc<ActorResolver>,
}

/// The wrapped context, which is shared between all handlers.
pub type Context = Arc<RawContext>;

impl RawContext {
    pub fn new(db: Box<dyn DataSource>, actors: Arc<ActorResolver>) -> Self {
        Self { db, actors }
    }
    // TODO add db/storage/redis
    pub fn build(self) -> Context {
        Arc::new(self)
    }
}
