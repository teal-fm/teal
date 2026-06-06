use std::collections::HashMap;

use rocketman::ingestion::{DefaultLexiconIngestor, LexiconIngestor};
use sqlx::PgPool;

use crate::ingestors;

pub fn build_ingestors(pool: PgPool) -> HashMap<String, Box<dyn LexiconIngestor + Send + Sync>> {
    let mut ingestors: HashMap<String, Box<dyn LexiconIngestor + Send + Sync>> = HashMap::new();

    ingestors.insert(
        "fm.teal.alpha.feed.play".to_string(),
        Box::new(ingestors::teal::feed_play::PlayIngestor::new(pool.clone())),
    );

    ingestors.insert(
        "fm.teal.alpha.actor.profile".to_string(),
        Box::new(ingestors::teal::actor_profile::ActorProfileIngestor::new(
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
        "fm.teal.alpha.actor.profileStatus".to_string(),
        Box::new(
            ingestors::teal::actor_profile_status::ActorProfileStatusIngestor::new(pool.clone()),
        ),
    );

    for (collection, kind) in [
        (
            "fm.teal.alpha.feed.social.post",
            ingestors::teal::social::SocialCollection::Post,
        ),
        (
            "fm.teal.alpha.feed.social.like",
            ingestors::teal::social::SocialCollection::Like,
        ),
        (
            "fm.teal.alpha.feed.social.repost",
            ingestors::teal::social::SocialCollection::Repost,
        ),
        (
            "fm.teal.alpha.graph.follow",
            ingestors::teal::social::SocialCollection::Follow,
        ),
        (
            "fm.teal.alpha.feed.social.playlist",
            ingestors::teal::social::SocialCollection::Playlist,
        ),
        (
            "fm.teal.alpha.feed.social.playlistItem",
            ingestors::teal::social::SocialCollection::PlaylistItem,
        ),
        (
            "fm.teal.alpha.feed.social.badge",
            ingestors::teal::social::SocialCollection::Badge,
        ),
        (
            "fm.teal.alpha.feed.social.badgeAssignment",
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
        "fm.teal.alpha.feed.play".to_string(),
        "fm.teal.alpha.actor.profile".to_string(),
        "fm.teal.alpha.actor.status".to_string(),
        "fm.teal.alpha.actor.profileStatus".to_string(),
        "fm.teal.alpha.feed.social.post".to_string(),
        "fm.teal.alpha.feed.social.like".to_string(),
        "fm.teal.alpha.feed.social.repost".to_string(),
        "fm.teal.alpha.graph.follow".to_string(),
        "fm.teal.alpha.feed.social.playlist".to_string(),
        "fm.teal.alpha.feed.social.playlistItem".to_string(),
        "fm.teal.alpha.feed.social.badge".to_string(),
        "fm.teal.alpha.feed.social.badgeAssignment".to_string(),
    ]
}
