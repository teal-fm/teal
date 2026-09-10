use anyhow::{anyhow, Context};
use async_trait::async_trait;
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};
use tracing::info;

use super::assemble_at_uri;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SocialCollection {
    Post,
    Like,
    Repost,
    Playlist,
    PlaylistItem,
    Badge,
    BadgeAssignment,
}

impl SocialCollection {
    pub fn nsid(self) -> &'static str {
        match self {
            Self::Post => "fm.teal.alpha.feed.social.post",
            Self::Like => "fm.teal.alpha.feed.social.like",
            Self::Repost => "fm.teal.alpha.feed.social.repost",
            Self::Playlist => "fm.teal.alpha.feed.social.playlist",
            Self::PlaylistItem => "fm.teal.alpha.feed.social.playlistItem",
            Self::Badge => "fm.teal.alpha.feed.social.badge",
            Self::BadgeAssignment => "fm.teal.alpha.feed.social.badgeAssignment",
        }
    }
}

pub struct SocialRecordIngestor {
    sql: PgPool,
    collection: SocialCollection,
}

impl SocialRecordIngestor {
    pub fn new(sql: PgPool, collection: SocialCollection) -> Self {
        Self { sql, collection }
    }

    pub async fn insert_record(
        &self,
        did: &str,
        rkey: &str,
        cid: &str,
        record: &Value,
    ) -> anyhow::Result<()> {
        let mut tx = self.sql.begin().await?;
        let uri = assemble_at_uri(did, self.collection.nsid(), rkey);

        self.remove_record_in_tx(&mut tx, &uri).await?;
        match self.collection {
            SocialCollection::Post => insert_post(&mut tx, &uri, did, rkey, cid, record).await?,
            SocialCollection::Like => insert_like(&mut tx, &uri, did, rkey, cid, record).await?,
            SocialCollection::Repost => {
                insert_repost(&mut tx, &uri, did, rkey, cid, record).await?
            }
            SocialCollection::Playlist => {
                insert_playlist(&mut tx, &uri, did, rkey, cid, record).await?
            }
            SocialCollection::PlaylistItem => {
                insert_playlist_item(&mut tx, &uri, did, rkey, cid, record).await?
            }
            SocialCollection::Badge => insert_badge(&mut tx, &uri, did, rkey, cid, record).await?,
            SocialCollection::BadgeAssignment => {
                insert_badge_assignment(&mut tx, &uri, did, rkey, cid, record).await?
            }
        }

        tx.commit().await?;
        info!("Indexed {} record {}", self.collection.nsid(), uri);
        Ok(())
    }

    pub async fn remove_record(&self, did: &str, rkey: &str) -> anyhow::Result<()> {
        let uri = assemble_at_uri(did, self.collection.nsid(), rkey);
        let mut tx = self.sql.begin().await?;
        self.remove_record_in_tx(&mut tx, &uri).await?;
        tx.commit().await?;
        info!("Deleted {} record {}", self.collection.nsid(), uri);
        Ok(())
    }

    async fn remove_record_in_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        uri: &str,
    ) -> anyhow::Result<()> {
        match self.collection {
            SocialCollection::Post => remove_post(tx, uri).await,
            SocialCollection::Like => remove_reaction(tx, uri, "social_likes", "like_count").await,
            SocialCollection::Repost => {
                remove_reaction(tx, uri, "social_reposts", "repost_count").await
            }
            SocialCollection::Playlist => remove_playlist(tx, uri).await,
            SocialCollection::PlaylistItem => remove_playlist_item(tx, uri).await,
            SocialCollection::Badge => remove_badge(tx, uri).await,
            SocialCollection::BadgeAssignment => remove_badge_assignment(tx, uri).await,
        }
    }
}

#[async_trait]
impl LexiconIngestor for SocialRecordIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        let commit = message
            .commit
            .as_ref()
            .ok_or_else(|| anyhow!("Message has no commit"))?;

        if let Some(record) = &commit.record {
            if let Some(cid) = &commit.cid {
                self.insert_record(&message.did, &commit.rkey, cid, record)
                    .await?;
            }
        } else {
            self.remove_record(&message.did, &commit.rkey).await?;
        }

        Ok(())
    }
}

async fn insert_post(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
    did: &str,
    rkey: &str,
    cid: &str,
    record: &Value,
) -> anyhow::Result<()> {
    let reply = record.get("reply");
    let root = reply.and_then(|r| r.get("root"));
    let parent = reply.and_then(|r| r.get("parent"));
    let parent_uri = ref_uri(parent);

    sqlx::query(
        r#"
            INSERT INTO social_posts (
                uri, did, rkey, cid, text, track,
                reply_root_uri, reply_root_cid, reply_parent_uri, reply_parent_cid,
                facets, langs, tags, created_at, record
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        "#,
    )
    .bind(uri)
    .bind(did)
    .bind(rkey)
    .bind(cid)
    .bind(required_str(record, "text")?)
    .bind(required_value(record, "track")?.clone())
    .bind(ref_uri(root))
    .bind(ref_cid(root))
    .bind(parent_uri.clone())
    .bind(ref_cid(parent))
    .bind(record.get("facets").cloned())
    .bind(string_array(record.get("langs"))?)
    .bind(string_array(record.get("tags"))?)
    .bind(required_datetime(record, "createdAt")?)
    .bind(record.clone())
    .execute(&mut **tx)
    .await?;

    if let Some(parent_uri) = parent_uri {
        increment_count(tx, &parent_uri, "reply_count", 1).await?;
        insert_notification(tx, did, "reply", uri, Some(&parent_uri), record).await?;
    }
    insert_facets(tx, uri, "facets", record.get("facets")).await?;
    Ok(())
}

async fn insert_like(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
    did: &str,
    rkey: &str,
    cid: &str,
    record: &Value,
) -> anyhow::Result<()> {
    insert_reaction(tx, "social_likes", uri, did, rkey, cid, record).await?;
    let subject_uri = required_ref_uri(record, "subject")?;
    increment_count(tx, &subject_uri, "like_count", 1).await?;
    insert_notification(tx, did, "like", uri, Some(&subject_uri), record).await
}

async fn insert_repost(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
    did: &str,
    rkey: &str,
    cid: &str,
    record: &Value,
) -> anyhow::Result<()> {
    insert_reaction(tx, "social_reposts", uri, did, rkey, cid, record).await?;
    let subject_uri = required_ref_uri(record, "subject")?;
    increment_count(tx, &subject_uri, "repost_count", 1).await?;
    insert_notification(tx, did, "repost", uri, Some(&subject_uri), record).await
}

async fn insert_reaction(
    tx: &mut Transaction<'_, Postgres>,
    table: &str,
    uri: &str,
    did: &str,
    rkey: &str,
    cid: &str,
    record: &Value,
) -> anyhow::Result<()> {
    let subject = required_value(record, "subject")?;
    let sql = format!(
        r#"
            INSERT INTO {table} (
                uri, did, rkey, cid, subject_uri, subject_cid, created_at, record
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#
    );

    sqlx::query(&sql)
        .bind(uri)
        .bind(did)
        .bind(rkey)
        .bind(cid)
        .bind(required_ref_uri(record, "subject")?)
        .bind(ref_cid(Some(subject)).ok_or_else(|| anyhow!("subject.cid is required"))?)
        .bind(required_datetime(record, "createdAt")?)
        .bind(record.clone())
        .execute(&mut **tx)
        .await?;

    Ok(())
}

async fn insert_playlist(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
    did: &str,
    rkey: &str,
    cid: &str,
    record: &Value,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
            INSERT INTO social_playlists (
                uri, did, rkey, cid, name, description, description_facets,
                authors, cover_cid, created_at, record
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#,
    )
    .bind(uri)
    .bind(did)
    .bind(rkey)
    .bind(cid)
    .bind(required_str(record, "name")?)
    .bind(optional_str(record, "description"))
    .bind(record.get("descriptionFacets").cloned())
    .bind(required_string_array(record, "authors")?)
    .bind(blob_cid(record.get("cover")))
    .bind(required_datetime(record, "createdAt")?)
    .bind(record.clone())
    .execute(&mut **tx)
    .await?;

    insert_facets(tx, uri, "description", record.get("descriptionFacets")).await?;
    insert_blob(tx, uri, "cover", record.get("cover")).await?;
    Ok(())
}

async fn insert_playlist_item(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
    did: &str,
    rkey: &str,
    cid: &str,
    record: &Value,
) -> anyhow::Result<()> {
    let playlist_uri = required_ref_uri(record, "subject")?;
    sqlx::query(
        r#"
            INSERT INTO social_playlist_items (
                uri, did, rkey, cid, playlist_uri, playlist_cid,
                track, item_order, created_at, record
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
    )
    .bind(uri)
    .bind(did)
    .bind(rkey)
    .bind(cid)
    .bind(&playlist_uri)
    .bind(ref_cid(record.get("subject")).ok_or_else(|| anyhow!("subject.cid is required"))?)
    .bind(required_value(record, "track")?.clone())
    .bind(optional_i64(record, "order").map(|value| value as i32))
    .bind(required_datetime(record, "createdAt")?)
    .bind(record.clone())
    .execute(&mut **tx)
    .await?;

    increment_count(tx, &playlist_uri, "playlist_item_count", 1).await?;
    Ok(())
}

async fn insert_badge(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
    did: &str,
    rkey: &str,
    cid: &str,
    record: &Value,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
            INSERT INTO social_badges (
                uri, did, rkey, cid, name, description, description_facets,
                image_cid, creator, badge_type, created_at, record
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        "#,
    )
    .bind(uri)
    .bind(did)
    .bind(rkey)
    .bind(cid)
    .bind(required_str(record, "name")?)
    .bind(required_str(record, "description")?)
    .bind(record.get("descriptionFacets").cloned())
    .bind(
        blob_cid(required_value(record, "image").ok())
            .ok_or_else(|| anyhow!("image CID is required"))?,
    )
    .bind(required_str(record, "creator")?)
    .bind(required_str(record, "type")?)
    .bind(required_datetime(record, "createdAt")?)
    .bind(record.clone())
    .execute(&mut **tx)
    .await?;

    insert_facets(tx, uri, "description", record.get("descriptionFacets")).await?;
    insert_blob(tx, uri, "image", record.get("image")).await?;
    Ok(())
}

async fn insert_badge_assignment(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
    did: &str,
    rkey: &str,
    cid: &str,
    record: &Value,
) -> anyhow::Result<()> {
    let badge_uri = required_ref_uri(record, "badge")?;
    let assignee = required_str(record, "assignee")?;
    sqlx::query(
        r#"
            INSERT INTO social_badge_assignments (
                uri, did, rkey, cid, badge_uri, badge_cid,
                assignee, assigner, created_at, record
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
    )
    .bind(uri)
    .bind(did)
    .bind(rkey)
    .bind(cid)
    .bind(&badge_uri)
    .bind(ref_cid(record.get("badge")).ok_or_else(|| anyhow!("badge.cid is required"))?)
    .bind(assignee)
    .bind(required_str(record, "assigner")?)
    .bind(required_datetime(record, "createdAt")?)
    .bind(record.clone())
    .execute(&mut **tx)
    .await?;

    insert_notification(tx, did, "badgeAssignment", uri, Some(&badge_uri), record).await
}

async fn remove_post(tx: &mut Transaction<'_, Postgres>, uri: &str) -> anyhow::Result<()> {
    if let Some(row) = sqlx::query_as::<_, (Option<String>,)>(
        "DELETE FROM social_posts WHERE uri = $1 RETURNING reply_parent_uri",
    )
    .bind(uri)
    .fetch_optional(&mut **tx)
    .await?
    {
        if let Some(parent_uri) = row.0 {
            increment_count(tx, &parent_uri, "reply_count", -1).await?;
        }
    }
    cleanup_record_indexes(tx, uri).await
}

async fn remove_reaction(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
    table: &str,
    count_column: &str,
) -> anyhow::Result<()> {
    let sql = format!("DELETE FROM {table} WHERE uri = $1 RETURNING subject_uri");
    if let Some(row) = sqlx::query_as::<_, (String,)>(&sql)
        .bind(uri)
        .fetch_optional(&mut **tx)
        .await?
    {
        increment_count(tx, &row.0, count_column, -1).await?;
    }
    cleanup_record_indexes(tx, uri).await
}

async fn remove_playlist(tx: &mut Transaction<'_, Postgres>, uri: &str) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM social_playlists WHERE uri = $1")
        .bind(uri)
        .execute(&mut **tx)
        .await?;
    cleanup_record_indexes(tx, uri).await
}

async fn remove_playlist_item(tx: &mut Transaction<'_, Postgres>, uri: &str) -> anyhow::Result<()> {
    if let Some(row) = sqlx::query_as::<_, (String,)>(
        "DELETE FROM social_playlist_items WHERE uri = $1 RETURNING playlist_uri",
    )
    .bind(uri)
    .fetch_optional(&mut **tx)
    .await?
    {
        increment_count(tx, &row.0, "playlist_item_count", -1).await?;
    }
    cleanup_record_indexes(tx, uri).await
}

async fn remove_badge(tx: &mut Transaction<'_, Postgres>, uri: &str) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM social_badges WHERE uri = $1")
        .bind(uri)
        .execute(&mut **tx)
        .await?;
    cleanup_record_indexes(tx, uri).await
}

async fn remove_badge_assignment(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM social_badge_assignments WHERE uri = $1")
        .bind(uri)
        .execute(&mut **tx)
        .await?;
    cleanup_record_indexes(tx, uri).await
}

async fn cleanup_record_indexes(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM indexed_record_facets WHERE record_uri = $1")
        .bind(uri)
        .execute(&mut **tx)
        .await?;
    sqlx::query("DELETE FROM indexed_record_blobs WHERE record_uri = $1")
        .bind(uri)
        .execute(&mut **tx)
        .await?;
    sqlx::query("DELETE FROM social_notifications WHERE record_uri = $1")
        .bind(uri)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn increment_count(
    tx: &mut Transaction<'_, Postgres>,
    subject_uri: &str,
    column: &str,
    delta: i32,
) -> anyhow::Result<()> {
    let sql = format!(
        r#"
            INSERT INTO social_subject_counts (subject_uri, {column})
            VALUES ($1, GREATEST($2, 0))
            ON CONFLICT (subject_uri) DO UPDATE SET
                {column} = GREATEST(social_subject_counts.{column} + $2, 0),
                updated_at = NOW()
        "#
    );
    sqlx::query(&sql)
        .bind(subject_uri)
        .bind(delta)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn insert_notification(
    tx: &mut Transaction<'_, Postgres>,
    actor_did: &str,
    reason: &str,
    record_uri: &str,
    subject_uri: Option<&str>,
    record: &Value,
) -> anyhow::Result<()> {
    let Some(recipient_did) = notification_recipient(subject_uri, record) else {
        return Ok(());
    };
    if recipient_did == actor_did {
        return Ok(());
    }

    sqlx::query(
        r#"
            INSERT INTO social_notifications (
                recipient_did, actor_did, reason, record_uri, subject_uri, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (recipient_did, reason, record_uri) DO UPDATE SET
                subject_uri = EXCLUDED.subject_uri,
                created_at = EXCLUDED.created_at,
                indexed_at = NOW()
        "#,
    )
    .bind(recipient_did)
    .bind(actor_did)
    .bind(reason)
    .bind(record_uri)
    .bind(subject_uri)
    .bind(required_datetime(record, "createdAt")?)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn insert_facets(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
    source_field: &str,
    facets: Option<&Value>,
) -> anyhow::Result<()> {
    let Some(facets) = facets else {
        return Ok(());
    };
    sqlx::query(
        r#"
            INSERT INTO indexed_record_facets (record_uri, source_field, facets)
            VALUES ($1, $2, $3)
            ON CONFLICT (record_uri, source_field) DO UPDATE SET
                facets = EXCLUDED.facets,
                indexed_at = NOW()
        "#,
    )
    .bind(uri)
    .bind(source_field)
    .bind(facets.clone())
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn insert_blob(
    tx: &mut Transaction<'_, Postgres>,
    uri: &str,
    source_field: &str,
    blob: Option<&Value>,
) -> anyhow::Result<()> {
    let Some(cid) = blob_cid(blob) else {
        return Ok(());
    };
    sqlx::query(
        r#"
            INSERT INTO indexed_record_blobs (record_uri, source_field, cid)
            VALUES ($1, $2, $3)
            ON CONFLICT (record_uri, source_field) DO UPDATE SET
                cid = EXCLUDED.cid,
                indexed_at = NOW()
        "#,
    )
    .bind(uri)
    .bind(source_field)
    .bind(cid)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn required_value<'a>(record: &'a Value, field: &str) -> anyhow::Result<&'a Value> {
    record
        .get(field)
        .ok_or_else(|| anyhow!("{field} is required"))
}

fn required_str(record: &Value, field: &str) -> anyhow::Result<String> {
    optional_str(record, field).ok_or_else(|| anyhow!("{field} is required"))
}

fn optional_str(record: &Value, field: &str) -> Option<String> {
    record
        .get(field)
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn required_datetime(record: &Value, field: &str) -> anyhow::Result<time::OffsetDateTime> {
    let value = required_str(record, field)?;
    time::OffsetDateTime::parse(&value, &time::format_description::well_known::Rfc3339)
        .with_context(|| format!("{field} must be an RFC3339 datetime"))
}

fn optional_i64(record: &Value, field: &str) -> Option<i64> {
    record.get(field).and_then(Value::as_i64)
}

fn required_string_array(record: &Value, field: &str) -> anyhow::Result<Vec<String>> {
    string_array(record.get(field))?.ok_or_else(|| anyhow!("{field} is required"))
}

fn string_array(value: Option<&Value>) -> anyhow::Result<Option<Vec<String>>> {
    value
        .map(|value| {
            value
                .as_array()
                .ok_or_else(|| anyhow!("expected array"))?
                .iter()
                .map(|item| {
                    item.as_str()
                        .map(ToString::to_string)
                        .ok_or_else(|| anyhow!("expected string array item"))
                })
                .collect()
        })
        .transpose()
}

fn required_ref_uri(record: &Value, field: &str) -> anyhow::Result<String> {
    ref_uri(record.get(field)).ok_or_else(|| anyhow!("{field}.uri is required"))
}

fn ref_uri(value: Option<&Value>) -> Option<String> {
    value
        .and_then(|value| value.get("uri"))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn ref_cid(value: Option<&Value>) -> Option<String> {
    value
        .and_then(|value| value.get("cid"))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn blob_cid(value: Option<&Value>) -> Option<String> {
    let value = value?;
    value
        .get("ref")
        .and_then(|ref_value| ref_value.get("$link").or_else(|| ref_value.get("link")))
        .or_else(|| value.get("$link"))
        .or_else(|| value.get("cid"))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn notification_recipient(subject_uri: Option<&str>, record: &Value) -> Option<String> {
    if let Some(assignee) = record.get("assignee").and_then(Value::as_str) {
        return Some(assignee.to_string());
    }
    subject_uri.and_then(did_from_at_uri)
}

fn did_from_at_uri(uri: &str) -> Option<String> {
    let rest = uri.strip_prefix("at://")?;
    rest.split('/').next().map(ToString::to_string)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{
        blob_cid, did_from_at_uri, notification_recipient, ref_cid, ref_uri, required_datetime,
        required_ref_uri, required_string_array, string_array,
    };

    #[test]
    fn extracts_refs_and_blob_cids_from_social_records() {
        let record = json!({
            "subject": {
                "uri": "at://did:plc:alice/fm.teal.alpha.feed.social.post/3k",
                "cid": "bafy-post"
            },
            "image": {
                "ref": { "$link": "bafy-image" }
            },
            "cover": {
                "cid": "bafy-cover"
            }
        });

        assert_eq!(
            required_ref_uri(&record, "subject").unwrap(),
            "at://did:plc:alice/fm.teal.alpha.feed.social.post/3k"
        );
        assert_eq!(
            ref_uri(record.get("subject")).as_deref(),
            Some("at://did:plc:alice/fm.teal.alpha.feed.social.post/3k")
        );
        assert_eq!(ref_cid(record.get("subject")).as_deref(), Some("bafy-post"));
        assert_eq!(blob_cid(record.get("image")).as_deref(), Some("bafy-image"));
        assert_eq!(blob_cid(record.get("cover")).as_deref(), Some("bafy-cover"));
    }

    #[test]
    fn validates_string_arrays_and_datetimes() {
        let record = json!({
            "authors": ["did:plc:alice", "did:plc:bob"],
            "langs": ["en", "es"],
            "createdAt": "2026-06-04T12:34:56Z"
        });

        assert_eq!(
            required_string_array(&record, "authors").unwrap(),
            vec!["did:plc:alice".to_string(), "did:plc:bob".to_string()]
        );
        assert_eq!(
            string_array(record.get("langs")).unwrap(),
            Some(vec!["en".to_string(), "es".to_string()])
        );
        assert_eq!(
            required_datetime(&record, "createdAt").unwrap().year(),
            2026
        );

        let invalid = json!({ "authors": ["did:plc:alice", 42] });
        assert!(required_string_array(&invalid, "authors").is_err());
    }

    #[test]
    fn resolves_notification_recipients_from_assignees_or_subjects() {
        let assignment = json!({ "assignee": "did:plc:badge-recipient" });
        assert_eq!(
            notification_recipient(None, &assignment).as_deref(),
            Some("did:plc:badge-recipient")
        );

        let reaction = json!({});
        assert_eq!(
            notification_recipient(
                Some("at://did:plc:post-author/fm.teal.alpha.feed.social.post/3k"),
                &reaction,
            )
            .as_deref(),
            Some("did:plc:post-author")
        );
        assert_eq!(
            did_from_at_uri("at://did:plc:post-author/fm.teal.alpha.feed.social.post/3k")
                .as_deref(),
            Some("did:plc:post-author")
        );
        assert!(did_from_at_uri("https://example.com/not-at-uri").is_none());
    }
}
