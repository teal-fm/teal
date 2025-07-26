use anyhow::anyhow;
use async_trait::async_trait;
use atrium_api::types::string::Datetime;
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::{types::Uuid, PgPool};

use super::assemble_at_uri;

pub struct PlayIngestor {
    sql: PgPool,
}

fn clean(
    record: &types::fm::teal::alpha::feed::play::RecordData,
) -> types::fm::teal::alpha::feed::play::RecordData {
    let mut cleaned = record.clone();

    // Clean artist MBIDs inside artists vector, if present
    if let Some(artists) = &mut cleaned.artists {
        for artist in artists.iter_mut() {
            if let Some(mbid) = &artist.artist_mb_id {
                if mbid.is_empty() {
                    artist.artist_mb_id = None;
                }
            }
        }
    }

    // // Clean artist_mb_ids vector, if present
    // if let Some(mbids) = &mut cleaned.artist_mb_ids {
    //     for mbid in mbids.iter_mut() {
    //         if mbid.is_empty() {
    //             *mbid = "";
    //         }
    //     }
    // }

    // Clean release_mb_id
    if let Some(release_mbid) = &cleaned.release_mb_id {
        if release_mbid.is_empty() {
            cleaned.release_mb_id = None;
        }
    }

    // Clean recording_mb_id
    if let Some(recording_mbid) = &cleaned.recording_mb_id {
        if recording_mbid.is_empty() {
            cleaned.recording_mb_id = None;
        }
    }

    cleaned
}

impl PlayIngestor {
    pub fn new(sql: PgPool) -> Self {
        Self { sql }
    }

    /// Inserts or updates an artist in the database.
    /// Returns the Uuid of the artist.
    async fn insert_artist(&self, mbid: &str, name: &str) -> anyhow::Result<Uuid> {
        let artist_uuid = Uuid::parse_str(mbid)?;
        let res = sqlx::query!(
            r#"
                INSERT INTO artists (mbid, name) VALUES ($1, $2)
                ON CONFLICT (mbid) DO NOTHING
                RETURNING mbid;
            "#,
            artist_uuid,
            name
        )
        .fetch_all(&self.sql)
        .await?;

        if !res.is_empty() {
            // TODO: send request to async scrape data from local MB instance
        }

        Ok(artist_uuid)
    }

    /// Inserts or updates a release in the database.
    /// Returns the Uuid of the release.
    async fn insert_release(&self, mbid: &str, name: &str) -> anyhow::Result<Uuid> {
        let release_uuid = Uuid::parse_str(mbid)?;
        let res = sqlx::query!(
            r#"
                INSERT INTO releases (mbid, name) VALUES ($1, $2)
                ON CONFLICT (mbid) DO NOTHING
                RETURNING mbid;
            "#,
            release_uuid,
            name
        )
        .fetch_all(&self.sql)
        .await?;

        if !res.is_empty() {
            // TODO: send request to async scrape data from local MB instance
        }

        Ok(release_uuid)
    }

    /// Inserts or updates a recording in the database.
    /// Returns the Uuid of the recording.
    async fn insert_recording(&self, mbid: &str, name: &str) -> anyhow::Result<Uuid> {
        let recording_uuid = Uuid::parse_str(mbid)?;
        let res = sqlx::query!(
            r#"
                INSERT INTO recordings (mbid, name) VALUES ($1, $2)
                ON CONFLICT (mbid) DO NOTHING
                RETURNING mbid;
            "#,
            recording_uuid,
            name
        )
        .fetch_all(&self.sql)
        .await?;

        if !res.is_empty() {
            // TODO: send request to async scrape data from local MB instance
        }

        Ok(recording_uuid)
    }

    pub async fn insert_play(
        &self,
        play_record: &types::fm::teal::alpha::feed::play::RecordData,
        uri: &str,
        cid: &str,
        did: &str,
        rkey: &str,
    ) -> anyhow::Result<()> {
        dbg!("ingesting", play_record);
        let play_record = clean(play_record);
        let mut parsed_artists: Vec<(Uuid, String)> = vec![];
        if let Some(ref artists) = &play_record.artists {
            for artist in artists {
                let artist_name = artist.artist_name.clone();
                let artist_mbid = artist.artist_mb_id.clone();
                if let Some(artist_mbid) = artist_mbid {
                    let artist_uuid = self.insert_artist(&artist_mbid, &artist_name).await?;
                    parsed_artists.push((artist_uuid, artist_name.clone()));
                } else {
                    // Handle case where artist MBID is missing, maybe log a warning
                    eprintln!("Warning: Artist MBID missing for '{}'", artist_name);
                }
            }
        } else {
            if let Some(artist_names) = &play_record.artist_names {
                for artist_name in artist_names {
                    // Assuming artist_mbid is optional, handle missing mbid gracefully
                    let artist_mbid_opt = if let Some(ref mbid_list) = play_record.artist_mb_ids {
                        mbid_list.get(
                            artist_names
                                .iter()
                                .position(|name| name == artist_name)
                                .unwrap_or(0),
                        )
                    } else {
                        None
                    };

                    if let Some(artist_mbid) = artist_mbid_opt {
                        let artist_uuid = self.insert_artist(artist_mbid, artist_name).await?;
                        parsed_artists.push((artist_uuid, artist_name.clone()));
                    } else {
                        // Handle case where artist MBID is missing, maybe log a warning
                        eprintln!("Warning: Artist MBID missing for '{}'", artist_name);
                    }
                }
            }
        }

        // Insert release if missing
        let release_mbid_opt = if let Some(release_mbid) = &play_record.release_mb_id {
            if let Some(release_name) = &play_record.release_name {
                Some(self.insert_release(release_mbid, release_name).await?)
            } else {
                None
            }
        } else {
            None
        };

        // Insert recording if missing
        let recording_mbid_opt = if let Some(recording_mbid) = &play_record.recording_mb_id {
            let recording_name = play_record.track_name.clone();
            Some(
                self.insert_recording(recording_mbid, &recording_name)
                    .await?,
            )
        } else {
            None
        };

        let played_time = play_record.played_time.clone().unwrap_or(Datetime::now());
        let time_datetime =
            time::OffsetDateTime::from_unix_timestamp(played_time.as_ref().timestamp())
                .unwrap_or_else(|_| time::OffsetDateTime::now_utc());

        // Our main insert into plays
        sqlx::query!(
            r#"
                INSERT INTO plays (
                    uri, cid, did, rkey, isrc, duration, track_name, played_time,
                    processed_time, release_mbid, release_name, recording_mbid,
                    submission_client_agent, music_service_base_domain
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8,
                    NOW(), $9, $10, $11, $12, $13
                ) ON CONFLICT(uri) DO UPDATE SET
                    isrc = EXCLUDED.isrc,
                    duration = EXCLUDED.duration,
                    track_name = EXCLUDED.track_name,
                    played_time = EXCLUDED.played_time,
                    processed_time = EXCLUDED.processed_time,
                    release_mbid = EXCLUDED.release_mbid,
                    release_name = EXCLUDED.release_name,
                    recording_mbid = EXCLUDED.recording_mbid,
                    submission_client_agent = EXCLUDED.submission_client_agent,
                    music_service_base_domain = EXCLUDED.music_service_base_domain;
            "#,
            uri,
            cid,
            did,
            rkey,
            play_record.isrc, // Assuming ISRC is in play_record
            play_record.duration.map(|d| d as i32),
            play_record.track_name,
            time_datetime,
            release_mbid_opt,
            play_record.release_name,
            recording_mbid_opt,
            play_record.submission_client_agent,
            play_record.music_service_base_domain,
        )
        .execute(&self.sql)
        .await?;

        // Insert plays into join table
        for (mbid, artist) in &parsed_artists {
            let artist_name = artist.clone(); // Clone to move into the query

            sqlx::query!(
                r#"
                        INSERT INTO play_to_artists (play_uri, artist_mbid, artist_name) VALUES
                        ($1, $2, $3)
                        ON CONFLICT (play_uri, artist_mbid) DO NOTHING;
                    "#,
                uri,
                mbid,
                artist_name
            )
            .execute(&self.sql)
            .await?;
        }

        // Refresh materialized views concurrently (if needed, consider if this should be done less frequently)
        sqlx::query!("REFRESH MATERIALIZED VIEW mv_artist_play_counts;")
            .execute(&self.sql)
            .await?;
        sqlx::query!("REFRESH MATERIALIZED VIEW mv_release_play_counts;")
            .execute(&self.sql)
            .await?;
        sqlx::query!("REFRESH MATERIALIZED VIEW mv_recording_play_counts;")
            .execute(&self.sql)
            .await?;
        sqlx::query!("REFRESH MATERIALIZED VIEW mv_global_play_count;")
            .execute(&self.sql)
            .await?;

        // // Optionally check materialised views (consider removing in production for performance)
        // // For debugging purposes, can keep for now
        // if cfg!(debug_assertions) {
        //     // Conditionally compile debug checks
        //     let artist_counts = sqlx::query!("SELECT * FROM mv_artist_play_counts;")
        //         .fetch_all(&self.sql)
        //         .await?;
        //     dbg!("mv_artist_play_counts: {:?}", artist_counts);

        //     let release_counts = sqlx::query!("SELECT * FROM mv_release_play_counts;")
        //         .fetch_all(&self.sql)
        //         .await?;
        //     dbg!("mv_release_play_counts: {:?}", release_counts);

        //     let recording_counts = sqlx::query!("SELECT * FROM mv_recording_play_counts;")
        //         .fetch_all(&self.sql)
        //         .await?;
        //     dbg!("mv_recording_play_counts: {:?}", recording_counts);

        //     let global_count = sqlx::query!("SELECT * FROM mv_global_play_count;")
        //         .fetch_all(&self.sql)
        //         .await?;
        //     dbg!("mv_global_play_count: {:?}", global_count);
        // }

        Ok(())
    }

    async fn remove_play(&self, uri: &str) -> Result<(), sqlx::Error> {
        sqlx::query!("DELETE FROM play_to_artists WHERE play_uri = $1", uri)
            .execute(&self.sql)
            .await?;
        sqlx::query!("DELETE FROM plays WHERE uri = $1", uri)
            .execute(&self.sql)
            .await?;
        Ok(())
    }
}

#[async_trait]
impl LexiconIngestor for PlayIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        if let Some(commit) = &message.commit {
            if let Some(ref record) = &commit.record {
                let play_record = serde_json::from_value::<
                    types::fm::teal::alpha::feed::play::RecordData,
                >(record.clone())?;
                if let Some(ref commit) = message.commit {
                    if let Some(ref cid) = commit.cid {
                        // TODO: verify cid
                        self.insert_play(
                            &play_record,
                            &assemble_at_uri(&message.did, &commit.collection, &commit.rkey),
                            cid,
                            &message.did,
                            &commit.rkey,
                        )
                        .await?;
                    }
                }
            } else {
                println!("{}: Message {} deleted", message.did, commit.rkey);
                self.remove_play(&message.did).await?;
            }
        } else {
            return Err(anyhow!("Message has no commit"));
        }
        Ok(())
    }
}
