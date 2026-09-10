use std::collections::HashMap;

use rocketman::ingestion::{DefaultLexiconIngestor, LexiconIngestor};
use sqlx::PgPool;

use crate::{
    ingestion_retry::{DurableRetryPlayIngestor, IngestionRetryStore},
    ingestors,
};

pub fn build_ingestors(pool: PgPool) -> HashMap<String, Box<dyn LexiconIngestor + Send + Sync>> {
    build_ingestors_with_retry(pool, None)
}

pub fn build_ingestors_with_retry(
    pool: PgPool,
    retry_store: Option<IngestionRetryStore>,
) -> HashMap<String, Box<dyn LexiconIngestor + Send + Sync>> {
    let mut ingestors: HashMap<String, Box<dyn LexiconIngestor + Send + Sync>> = HashMap::new();

    let play_ingestor: Box<dyn LexiconIngestor + Send + Sync> = match retry_store {
        Some(retry_store) => Box::new(DurableRetryPlayIngestor::new(pool.clone(), retry_store)),
        None => Box::new(ingestors::teal::feed_play::PlayIngestor::new(pool.clone())),
    };
    ingestors.insert("fm.teal.feed.play".to_string(), play_ingestor);
    ingestors.insert(
        "fm.teal.alpha.feed.play".to_string(),
        Box::new(ingestors::teal::feed_play::PlayIngestor::new(pool.clone())),
    );

    ingestors.insert(
        "fm.teal.actor.profile".to_string(),
        Box::new(ingestors::teal::actor_profile::ActorProfileIngestor::new(
            pool.clone(),
        )),
    );
    ingestors.insert(
        "fm.teal.alpha.actor.profile".to_string(),
        Box::new(ingestors::teal::actor_profile::ActorProfileIngestor::new(
            pool.clone(),
        )),
    );

    ingestors.insert(
        "fm.teal.actor.status".to_string(),
        Box::new(ingestors::teal::actor_status::ActorStatusIngestor::new(
            pool.clone(),
        )),
    );
    ingestors.insert(
        "fm.teal.alpha.actor.status".to_string(),
        Box::new(ingestors::teal::actor_status::ActorStatusIngestor::new(
            pool.clone(),
        )),
    );

    ingestors.insert(
        "fm.teal.actor.profileStatus".to_string(),
        Box::new(
            ingestors::teal::actor_profile_status::ActorProfileStatusIngestor::new(pool.clone()),
        ),
    );
    ingestors.insert(
        "fm.teal.alpha.actor.profileStatus".to_string(),
        Box::new(
            ingestors::teal::actor_profile_status::ActorProfileStatusIngestor::new(pool.clone()),
        ),
    );

    for (collection, kind) in [
        (
            "fm.teal.feed.social.post",
            ingestors::teal::social::SocialCollection::Post,
        ),
        (
            "fm.teal.feed.social.like",
            ingestors::teal::social::SocialCollection::Like,
        ),
        (
            "fm.teal.feed.social.repost",
            ingestors::teal::social::SocialCollection::Repost,
        ),
        (
            "fm.teal.graph.follow",
            ingestors::teal::social::SocialCollection::Follow,
        ),
        (
            "fm.teal.feed.social.playlist",
            ingestors::teal::social::SocialCollection::Playlist,
        ),
        (
            "fm.teal.feed.social.playlistItem",
            ingestors::teal::social::SocialCollection::PlaylistItem,
        ),
        (
            "fm.teal.feed.social.badge",
            ingestors::teal::social::SocialCollection::Badge,
        ),
        (
            "fm.teal.feed.social.badgeAssignment",
            ingestors::teal::social::SocialCollection::BadgeAssignment,
        ),
    ] {
        ingestors.insert(
            collection.to_string(),
            Box::new(ingestors::teal::social::SocialRecordIngestor::new(
                pool.clone(),
                kind,
            )),
        );
    }

    ingestors.insert(
        "com.atproto.repo.importRepo".to_string(),
        Box::new(ingestors::car::CarImportIngestor::new(pool.clone())),
    );

    ingestors.insert(
        "app.bsky.feed.post".to_string(),
        Box::new(DefaultLexiconIngestor),
    );

    ingestors
}

pub fn supported_teal_collections() -> Vec<String> {
    build_ingestors_for_names()
        .into_iter()
        .filter(|collection| collection.starts_with("fm.teal."))
        .collect()
}

fn build_ingestors_for_names() -> Vec<String> {
    vec![
        "fm.teal.feed.play".to_string(),
        "fm.teal.actor.profile".to_string(),
        "fm.teal.actor.status".to_string(),
        "fm.teal.actor.profileStatus".to_string(),
        "fm.teal.feed.social.post".to_string(),
        "fm.teal.feed.social.like".to_string(),
        "fm.teal.feed.social.repost".to_string(),
        "fm.teal.graph.follow".to_string(),
        "fm.teal.feed.social.playlist".to_string(),
        "fm.teal.feed.social.playlistItem".to_string(),
        "fm.teal.feed.social.badge".to_string(),
        "fm.teal.feed.social.badgeAssignment".to_string(),
    ]
}
