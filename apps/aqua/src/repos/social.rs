use async_trait::async_trait;
use serde::Serialize;
use serde_json::Value;
use types::fm_teal::alpha::actor::MiniProfileView;

use super::{mini_profile, pg::PgDataSource, time_to_chrono_utc, utc_to_atrium_datetime};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialPostView {
    pub uri: String,
    pub cid: String,
    pub author_did: String,
    pub author: Option<MiniProfileView>,
    pub text: String,
    pub track: Value,
    pub reply_root_uri: Option<String>,
    pub reply_root_cid: Option<String>,
    pub reply_parent_uri: Option<String>,
    pub reply_parent_cid: Option<String>,
    pub facets: Option<Value>,
    pub langs: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub created_at: jacquard_common::types::string::Datetime,
    pub like_count: i32,
    pub repost_count: i32,
    pub reply_count: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialActorActionView {
    pub uri: String,
    pub cid: String,
    pub actor_did: String,
    pub actor: Option<MiniProfileView>,
    pub created_at: jacquard_common::types::string::Datetime,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialPlaylistView {
    pub uri: String,
    pub cid: String,
    pub author_did: String,
    pub author: Option<MiniProfileView>,
    pub name: String,
    pub description: Option<String>,
    pub description_facets: Option<Value>,
    pub authors: Vec<String>,
    pub cover_cid: Option<String>,
    pub created_at: jacquard_common::types::string::Datetime,
    pub item_count: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialPlaylistItemView {
    pub uri: String,
    pub cid: String,
    pub author_did: String,
    pub track: Value,
    pub order: Option<i32>,
    pub created_at: jacquard_common::types::string::Datetime,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialBadgeView {
    pub uri: String,
    pub cid: String,
    pub name: String,
    pub description: String,
    pub description_facets: Option<Value>,
    pub image_cid: String,
    pub creator: String,
    pub badge_type: String,
    pub created_at: jacquard_common::types::string::Datetime,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialBadgeAssignmentView {
    pub uri: String,
    pub cid: String,
    pub badge: SocialBadgeView,
    pub assignee: String,
    pub assigner: String,
    pub created_at: jacquard_common::types::string::Datetime,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialNotificationView {
    pub id: i64,
    pub actor_did: String,
    pub actor: Option<MiniProfileView>,
    pub reason: String,
    pub record_uri: String,
    pub subject_uri: Option<String>,
    pub created_at: jacquard_common::types::string::Datetime,
}

pub struct Page<T> {
    pub items: Vec<T>,
    pub cursor: Option<String>,
}

#[derive(sqlx::FromRow)]
struct PostRow {
    uri: String,
    cid: String,
    did: String,
    text: String,
    track: Value,
    reply_root_uri: Option<String>,
    reply_root_cid: Option<String>,
    reply_parent_uri: Option<String>,
    reply_parent_cid: Option<String>,
    facets: Option<Value>,
    langs: Option<Vec<String>>,
    tags: Option<Vec<String>>,
    created_at: time::OffsetDateTime,
    profile_did: Option<String>,
    profile_handle: Option<String>,
    profile_display_name: Option<String>,
    profile_avatar: Option<String>,
    like_count: i32,
    repost_count: i32,
    reply_count: i32,
}

fn normalize_limit(limit: Option<i32>) -> i64 {
    limit.unwrap_or(50).clamp(1, 100) as i64
}

fn decode_offset(cursor: Option<&str>) -> anyhow::Result<i64> {
    crate::repos::stats::decode_offset_cursor(cursor)
}

fn encode_offset(offset: i64) -> anyhow::Result<String> {
    crate::repos::stats::encode_offset_cursor(offset)
}

fn page_cursor<T>(rows: &[T], limit: i64, offset: i64) -> anyhow::Result<Option<String>> {
    if rows.len() > limit as usize {
        Ok(Some(encode_offset(offset + limit)?))
    } else {
        Ok(None)
    }
}

fn dt(value: time::OffsetDateTime) -> jacquard_common::types::string::Datetime {
    utc_to_atrium_datetime(time_to_chrono_utc(value))
}

#[async_trait]
pub trait SocialRepo {
    async fn get_social_feed(
        &self,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialPostView>>;
    async fn get_post(&self, uri: &str) -> anyhow::Result<Option<SocialPostView>>;
    async fn get_post_replies(
        &self,
        uri: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialPostView>>;
    async fn get_post_likes(
        &self,
        uri: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialActorActionView>>;
    async fn get_post_reposts(
        &self,
        uri: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialActorActionView>>;
    async fn get_actor_playlists(
        &self,
        actor: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialPlaylistView>>;
    async fn get_playlist(
        &self,
        uri: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Option<(SocialPlaylistView, Page<SocialPlaylistItemView>)>>;
    async fn get_badge_catalog(
        &self,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialBadgeView>>;
    async fn get_actor_badges(
        &self,
        actor: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialBadgeAssignmentView>>;
    async fn get_notifications(
        &self,
        actor: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialNotificationView>>;
}

#[async_trait]
impl SocialRepo for PgDataSource {
    async fn get_social_feed(
        &self,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialPostView>> {
        let limit = normalize_limit(limit);
        let offset = decode_offset(cursor)?;
        let rows = fetch_posts(
            self,
            "WHERE $3::text IS NULL AND p.reply_parent_uri IS NULL ORDER BY p.created_at DESC LIMIT $1 OFFSET $2",
            limit,
            offset,
            None,
        )
        .await?;
        let cursor = page_cursor(&rows, limit, offset)?;
        Ok(Page {
            items: rows.into_iter().take(limit as usize).collect(),
            cursor,
        })
    }

    async fn get_post(&self, uri: &str) -> anyhow::Result<Option<SocialPostView>> {
        let rows = fetch_posts(self, "WHERE p.uri = $3 LIMIT 1", 1, 0, Some(uri)).await?;
        Ok(rows.into_iter().next())
    }

    async fn get_post_replies(
        &self,
        uri: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialPostView>> {
        let limit = normalize_limit(limit);
        let offset = decode_offset(cursor)?;
        let rows = fetch_posts(
            self,
            "WHERE p.reply_parent_uri = $3 ORDER BY p.created_at ASC LIMIT $1 OFFSET $2",
            limit,
            offset,
            Some(uri),
        )
        .await?;
        let cursor = page_cursor(&rows, limit, offset)?;
        Ok(Page {
            items: rows.into_iter().take(limit as usize).collect(),
            cursor,
        })
    }

    async fn get_post_likes(
        &self,
        uri: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialActorActionView>> {
        fetch_actions(self, "social_likes", uri, limit, cursor).await
    }

    async fn get_post_reposts(
        &self,
        uri: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialActorActionView>> {
        fetch_actions(self, "social_reposts", uri, limit, cursor).await
    }

    async fn get_actor_playlists(
        &self,
        actor: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialPlaylistView>> {
        let limit = normalize_limit(limit);
        let offset = decode_offset(cursor)?;
        let did = resolve_actor_to_did(self, actor).await?;
        let rows = fetch_playlists(
            self,
            "WHERE p.did = $3 OR $3 = ANY(p.authors) ORDER BY p.created_at DESC LIMIT $1 OFFSET $2",
            limit,
            offset,
            Some(&did),
        )
        .await?;
        let cursor = page_cursor(&rows, limit, offset)?;
        Ok(Page {
            items: rows.into_iter().take(limit as usize).collect(),
            cursor,
        })
    }

    async fn get_playlist(
        &self,
        uri: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Option<(SocialPlaylistView, Page<SocialPlaylistItemView>)>> {
        let playlist = fetch_playlists(self, "WHERE p.uri = $3 LIMIT 1", 1, 0, Some(uri))
            .await?
            .into_iter()
            .next();
        let Some(playlist) = playlist else {
            return Ok(None);
        };

        let limit = normalize_limit(limit);
        let offset = decode_offset(cursor)?;
        let rows = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                Value,
                Option<i32>,
                time::OffsetDateTime,
            ),
        >(
            r#"
                SELECT uri, cid, did, track, item_order, created_at
                FROM social_playlist_items
                WHERE playlist_uri = $1
                ORDER BY item_order ASC NULLS LAST, created_at ASC
                LIMIT $2 OFFSET $3
            "#,
        )
        .bind(uri)
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&self.db)
        .await?;
        let cursor = page_cursor(&rows, limit, offset)?;
        let items = rows
            .into_iter()
            .take(limit as usize)
            .map(|row| SocialPlaylistItemView {
                uri: row.0,
                cid: row.1,
                author_did: row.2,
                track: row.3,
                order: row.4,
                created_at: dt(row.5),
            })
            .collect();

        Ok(Some((playlist, Page { items, cursor })))
    }

    async fn get_badge_catalog(
        &self,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialBadgeView>> {
        let limit = normalize_limit(limit);
        let offset = decode_offset(cursor)?;
        let rows = fetch_badges(
            self,
            "WHERE $3::text IS NULL ORDER BY b.created_at DESC LIMIT $1 OFFSET $2",
            limit,
            offset,
            None,
        )
        .await?;
        let cursor = page_cursor(&rows, limit, offset)?;
        Ok(Page {
            items: rows.into_iter().take(limit as usize).collect(),
            cursor,
        })
    }

    async fn get_actor_badges(
        &self,
        actor: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialBadgeAssignmentView>> {
        let did = resolve_actor_to_did(self, actor).await?;
        let limit = normalize_limit(limit);
        let offset = decode_offset(cursor)?;
        let rows = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                String,
                String,
                String,
                String,
                String,
                Option<Value>,
                String,
                String,
                String,
                time::OffsetDateTime,
                time::OffsetDateTime,
            ),
        >(
            r#"
                SELECT
                    a.uri, a.cid, a.assignee, a.assigner,
                    b.uri, b.cid, b.name, b.description, b.description_facets,
                    b.image_cid, b.creator, b.badge_type, b.created_at, a.created_at
                FROM social_badge_assignments a
                INNER JOIN social_badges b ON a.badge_uri = b.uri
                WHERE a.assignee = $1
                ORDER BY a.created_at DESC
                LIMIT $2 OFFSET $3
            "#,
        )
        .bind(did)
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&self.db)
        .await?;
        let cursor = page_cursor(&rows, limit, offset)?;
        let items = rows
            .into_iter()
            .take(limit as usize)
            .map(|row| SocialBadgeAssignmentView {
                uri: row.0,
                cid: row.1,
                assignee: row.2,
                assigner: row.3,
                badge: SocialBadgeView {
                    uri: row.4,
                    cid: row.5,
                    name: row.6,
                    description: row.7,
                    description_facets: row.8,
                    image_cid: row.9,
                    creator: row.10,
                    badge_type: row.11,
                    created_at: dt(row.12),
                },
                created_at: dt(row.13),
            })
            .collect();
        Ok(Page { items, cursor })
    }

    async fn get_notifications(
        &self,
        actor: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<Page<SocialNotificationView>> {
        let did = resolve_actor_to_did(self, actor).await?;
        let limit = normalize_limit(limit);
        let offset = decode_offset(cursor)?;
        let rows = sqlx::query_as::<
            _,
            (
                i64,
                String,
                String,
                String,
                Option<String>,
                time::OffsetDateTime,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
            ),
        >(
            r#"
                SELECT
                    n.id, n.actor_did, n.reason, n.record_uri, n.subject_uri, n.created_at,
                    p.did, p.handle, p.display_name, p.avatar
                FROM social_notifications n
                LEFT JOIN profiles p ON n.actor_did = p.did
                WHERE n.recipient_did = $1
                ORDER BY n.created_at DESC, n.id DESC
                LIMIT $2 OFFSET $3
            "#,
        )
        .bind(did)
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&self.db)
        .await?;
        let cursor = page_cursor(&rows, limit, offset)?;
        let items = rows
            .into_iter()
            .take(limit as usize)
            .map(|row| SocialNotificationView {
                id: row.0,
                actor_did: row.1,
                actor: mini_profile(row.6, row.7, row.8, row.9),
                reason: row.2,
                record_uri: row.3,
                subject_uri: row.4,
                created_at: dt(row.5),
            })
            .collect();
        Ok(Page { items, cursor })
    }
}

async fn fetch_posts(
    repo: &PgDataSource,
    clause: &str,
    limit: i64,
    offset: i64,
    uri: Option<&str>,
) -> anyhow::Result<Vec<SocialPostView>> {
    let sql = format!(
        r#"
            SELECT
                p.uri, p.cid, p.did, p.text, p.track, p.reply_root_uri, p.reply_parent_uri,
                p.reply_root_cid, p.reply_parent_cid, p.facets, p.langs, p.tags, p.created_at,
                profile.did AS profile_did,
                profile.handle AS profile_handle,
                profile.display_name AS profile_display_name,
                profile.avatar AS profile_avatar,
                COALESCE(c.like_count, 0) AS like_count,
                COALESCE(c.repost_count, 0) AS repost_count,
                COALESCE(c.reply_count, 0) AS reply_count
            FROM social_posts p
            LEFT JOIN profiles profile ON p.did = profile.did
            LEFT JOIN social_subject_counts c ON p.uri = c.subject_uri
            {clause}
        "#
    );
    let rows = sqlx::query_as::<_, PostRow>(&sql)
    .bind(limit + 1)
    .bind(offset)
    .bind(uri)
    .fetch_all(&repo.db)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| SocialPostView {
            uri: row.uri,
            cid: row.cid,
            author_did: row.did,
            text: row.text,
            track: row.track,
            reply_root_uri: row.reply_root_uri,
            reply_root_cid: row.reply_root_cid,
            reply_parent_uri: row.reply_parent_uri,
            reply_parent_cid: row.reply_parent_cid,
            facets: row.facets,
            langs: row.langs,
            tags: row.tags,
            created_at: dt(row.created_at),
            author: mini_profile(
                row.profile_did,
                row.profile_handle,
                row.profile_display_name,
                row.profile_avatar,
            ),
            like_count: row.like_count,
            repost_count: row.repost_count,
            reply_count: row.reply_count,
        })
        .collect())
}

async fn fetch_actions(
    repo: &PgDataSource,
    table: &str,
    uri: &str,
    limit: Option<i32>,
    cursor: Option<&str>,
) -> anyhow::Result<Page<SocialActorActionView>> {
    let limit = normalize_limit(limit);
    let offset = decode_offset(cursor)?;
    let sql = format!(
        r#"
            SELECT a.uri, a.cid, a.did, a.created_at, p.did, p.handle, p.display_name, p.avatar
            FROM {table} a
            LEFT JOIN profiles p ON a.did = p.did
            WHERE a.subject_uri = $1
            ORDER BY a.created_at DESC
            LIMIT $2 OFFSET $3
        "#
    );
    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            time::OffsetDateTime,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(&sql)
    .bind(uri)
    .bind(limit + 1)
    .bind(offset)
    .fetch_all(&repo.db)
    .await?;
    let cursor = page_cursor(&rows, limit, offset)?;
    let items = rows
        .into_iter()
        .take(limit as usize)
        .map(|row| SocialActorActionView {
            uri: row.0,
            cid: row.1,
            actor_did: row.2,
            created_at: dt(row.3),
            actor: mini_profile(row.4, row.5, row.6, row.7),
        })
        .collect();
    Ok(Page { items, cursor })
}

async fn fetch_playlists(
    repo: &PgDataSource,
    clause: &str,
    limit: i64,
    offset: i64,
    did_or_uri: Option<&str>,
) -> anyhow::Result<Vec<SocialPlaylistView>> {
    let sql = format!(
        r#"
            SELECT
                p.uri, p.cid, p.did, p.name, p.description, p.description_facets,
                p.authors, p.cover_cid, p.created_at,
                profile.did, profile.handle, profile.display_name, profile.avatar,
                COALESCE(c.playlist_item_count, 0)
            FROM social_playlists p
            LEFT JOIN profiles profile ON p.did = profile.did
            LEFT JOIN social_subject_counts c ON p.uri = c.subject_uri
            {clause}
        "#
    );
    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            String,
            Option<String>,
            Option<Value>,
            Vec<String>,
            Option<String>,
            time::OffsetDateTime,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            i32,
        ),
    >(&sql)
    .bind(limit + 1)
    .bind(offset)
    .bind(did_or_uri)
    .fetch_all(&repo.db)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| SocialPlaylistView {
            uri: row.0,
            cid: row.1,
            author_did: row.2,
            name: row.3,
            description: row.4,
            description_facets: row.5,
            authors: row.6,
            cover_cid: row.7,
            created_at: dt(row.8),
            author: mini_profile(row.9, row.10, row.11, row.12),
            item_count: row.13,
        })
        .collect())
}

async fn fetch_badges(
    repo: &PgDataSource,
    clause: &str,
    limit: i64,
    offset: i64,
    uri: Option<&str>,
) -> anyhow::Result<Vec<SocialBadgeView>> {
    let sql = format!(
        r#"
            SELECT
                b.uri, b.cid, b.name, b.description, b.description_facets,
                b.image_cid, b.creator, b.badge_type, b.created_at
            FROM social_badges b
            {clause}
        "#
    );
    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            String,
            Option<Value>,
            String,
            String,
            String,
            time::OffsetDateTime,
        ),
    >(&sql)
    .bind(limit + 1)
    .bind(offset)
    .bind(uri)
    .fetch_all(&repo.db)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| SocialBadgeView {
            uri: row.0,
            cid: row.1,
            name: row.2,
            description: row.3,
            description_facets: row.4,
            image_cid: row.5,
            creator: row.6,
            badge_type: row.7,
            created_at: dt(row.8),
        })
        .collect())
}

async fn resolve_actor_to_did(repo: &PgDataSource, actor: &str) -> anyhow::Result<String> {
    if actor.starts_with("did:") {
        return Ok(actor.to_string());
    }

    if let Some(row) = sqlx::query_as::<_, (String,)>(
        "SELECT did FROM profiles WHERE LOWER(handle) = LOWER($1) LIMIT 1",
    )
    .bind(actor.trim_start_matches("at://"))
    .fetch_optional(&repo.db)
    .await?
    {
        return Ok(row.0);
    }

    anyhow::bail!("unknown indexed actor: {actor}")
}

#[cfg(test)]
mod tests {
    use super::normalize_limit;

    #[test]
    fn social_limits_are_bounded() {
        assert_eq!(normalize_limit(None), 50);
        assert_eq!(normalize_limit(Some(0)), 1);
        assert_eq!(normalize_limit(Some(250)), 100);
    }
}
