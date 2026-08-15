use async_trait::async_trait;
use types::fm_teal::actor::MiniProfileView;

use super::{mini_profile, pg::PgDataSource};

pub struct GraphSummary {
    pub followers_count: i64,
    pub follows_count: i64,
    pub viewer_following: Option<String>,
}

pub struct GraphListPage {
    pub actors: Vec<MiniProfileView>,
    pub cursor: Option<String>,
}

#[async_trait]
pub trait GraphRepo: Send + Sync {
    async fn get_graph_summary(
        &self,
        actor: &str,
        viewer: Option<&str>,
    ) -> anyhow::Result<GraphSummary>;
    async fn get_followers(
        &self,
        actor: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<GraphListPage>;
    async fn get_follows(
        &self,
        actor: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<GraphListPage>;
}

#[derive(sqlx::FromRow)]
struct ActorRow {
    did: String,
    handle: Option<String>,
    display_name: Option<String>,
    avatar: Option<String>,
}

#[derive(sqlx::FromRow)]
struct CountRow {
    count: i64,
}

#[derive(sqlx::FromRow)]
struct FollowUriRow {
    uri: String,
}

#[async_trait]
impl GraphRepo for PgDataSource {
    async fn get_graph_summary(
        &self,
        actor: &str,
        viewer: Option<&str>,
    ) -> anyhow::Result<GraphSummary> {
        let actor_did = self.resolve_graph_actor(actor).await?;
        let followers_count = sqlx::query_as::<_, CountRow>(
            "SELECT COUNT(*) AS count FROM social_follows WHERE subject_did = $1",
        )
        .bind(&actor_did)
        .fetch_one(&self.db)
        .await?
        .count;
        let follows_count = sqlx::query_as::<_, CountRow>(
            "SELECT COUNT(*) AS count FROM social_follows WHERE did = $1",
        )
        .bind(&actor_did)
        .fetch_one(&self.db)
        .await?
        .count;
        let viewer_following = match viewer {
            Some(viewer) if viewer != actor_did => sqlx::query_as::<_, FollowUriRow>(
                "SELECT uri FROM social_follows WHERE did = $1 AND subject_did = $2 LIMIT 1",
            )
            .bind(viewer)
            .bind(&actor_did)
            .fetch_optional(&self.db)
            .await?
            .map(|row| row.uri),
            _ => None,
        };

        Ok(GraphSummary {
            followers_count,
            follows_count,
            viewer_following,
        })
    }

    async fn get_followers(
        &self,
        actor: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<GraphListPage> {
        let actor_did = self.resolve_graph_actor(actor).await?;
        self.get_graph_list(
            r#"
                SELECT
                    COALESCE(p.did, f.did) AS did,
                    p.handle,
                    p.display_name,
                    p.avatar
                FROM social_follows f
                LEFT JOIN profiles p ON p.did = f.did
                WHERE f.subject_did = $1
                ORDER BY f.created_at DESC, f.uri DESC
                LIMIT $2 OFFSET $3
            "#,
            &actor_did,
            limit,
            cursor,
        )
        .await
    }

    async fn get_follows(
        &self,
        actor: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<GraphListPage> {
        let actor_did = self.resolve_graph_actor(actor).await?;
        self.get_graph_list(
            r#"
                SELECT
                    COALESCE(p.did, f.subject_did) AS did,
                    p.handle,
                    p.display_name,
                    p.avatar
                FROM social_follows f
                LEFT JOIN profiles p ON p.did = f.subject_did
                WHERE f.did = $1
                ORDER BY f.created_at DESC, f.uri DESC
                LIMIT $2 OFFSET $3
            "#,
            &actor_did,
            limit,
            cursor,
        )
        .await
    }
}

impl PgDataSource {
    async fn resolve_graph_actor(&self, actor: &str) -> anyhow::Result<String> {
        if actor.starts_with("did:") {
            return Ok(actor.to_string());
        }

        let row = sqlx::query_as::<_, ActorRow>(
            "SELECT did, handle, display_name, avatar FROM profiles WHERE LOWER(handle) = LOWER($1) LIMIT 1",
        )
        .bind(actor)
        .fetch_optional(&self.db)
        .await?;

        row.map(|row| row.did)
            .ok_or_else(|| anyhow::anyhow!("actor not found"))
    }

    async fn get_graph_list(
        &self,
        sql: &str,
        actor_did: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<GraphListPage> {
        let limit = limit.unwrap_or(50).clamp(1, 100) as i64;
        let offset = cursor
            .and_then(|cursor| cursor.parse::<i64>().ok())
            .unwrap_or_default()
            .max(0);
        let rows = sqlx::query_as::<_, ActorRow>(sql)
            .bind(actor_did)
            .bind(limit + 1)
            .bind(offset)
            .fetch_all(&self.db)
            .await?;
        let has_more = rows.len() > limit as usize;
        let actors = rows
            .into_iter()
            .take(limit as usize)
            .filter_map(|row| mini_profile(Some(row.did), row.handle, row.display_name, row.avatar))
            .collect::<Vec<_>>();

        Ok(GraphListPage {
            actors,
            cursor: if has_more {
                Some((offset + limit).to_string())
            } else {
                None
            },
        })
    }
}
