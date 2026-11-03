//! Listening-centred views for the redesigned app: what the viewer's circle is playing
//! today, emoji reactions, taste match between two accounts, and per-day listening.

use std::collections::HashMap;

use anyhow::anyhow;
use async_trait::async_trait;
use serde::Serialize;
use serde_json::Value;
use types::fm_teal::actor::MiniProfileView;
use uuid::Uuid;

use super::{
    mini_profile, pg::PgDataSource, social::resolve_actor_to_did, time_to_chrono_utc,
    utc_to_atrium_datetime,
};

type Datetime = jacquard_common::types::string::Datetime;

/// How recent a play must be for its listener to appear on Today at all.
const LISTENING_WINDOW: &str = "6 hours";
/// Mutuals on the same release within this window form a group moment.
const MUTUALS_WINDOW: &str = "45 minutes";
/// Network-wide "everyone on teal" looks at this window.
const NETWORK_WINDOW: &str = "30 minutes";
/// Taste match compares each account's top artists over this window.
const TASTE_WINDOW: &str = "180 days";
const TOP_ARTIST_COUNT: i64 = 20;
const MAX_CALENDAR_DAYS: i64 = 62;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReactionSummary {
    pub emoji: String,
    pub count: i32,
    pub viewer_reaction: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListeningView {
    pub actor: Option<MiniProfileView>,
    pub play_uri: String,
    pub play_cid: Option<String>,
    pub track_name: String,
    pub artist_name: Option<String>,
    pub recording_mb_id: Option<String>,
    pub release_mb_id: Option<String>,
    pub release_name: Option<String>,
    pub played_time: Datetime,
    pub listening_now: bool,
    pub track_plays_today: i32,
    pub release_plays_today: i32,
    pub first_release_listen: bool,
    pub reactions: Vec<ReactionSummary>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseSummary {
    pub release_mb_id: Option<String>,
    pub release_name: String,
    pub artist_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MomentView {
    pub kind: &'static str,
    pub release: ReleaseSummary,
    pub listener_count: i32,
    pub listeners: Vec<MiniProfileView>,
    pub change_percent: Option<i32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayView {
    pub listening: Vec<ListeningView>,
    pub moments: Vec<MomentView>,
    pub heating_up: Vec<MomentView>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReactionView {
    pub uri: String,
    pub emoji: String,
    pub actor_did: String,
    pub actor: Option<MiniProfileView>,
    pub created_at: Datetime,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReactionsPage {
    pub summary: Vec<ReactionSummary>,
    pub reactions: Vec<ReactionView>,
    pub cursor: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedArtist {
    pub name: String,
    pub release_mb_id: Option<String>,
    pub release_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TasteSuggestion {
    pub release_mb_id: Option<String>,
    pub release_name: String,
    pub artist_name: Option<String>,
    pub rank: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TasteMatchView {
    pub level: &'static str,
    pub shared_artist_count: i32,
    pub top_artist_count: i32,
    pub shared_artists: Vec<SharedArtist>,
    pub suggestion: Option<TasteSuggestion>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HourView {
    pub hour: i32,
    pub play_count: i32,
    pub release_mb_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayView {
    pub date: String,
    pub play_count: i32,
    pub top_release: Option<ReleaseSummary>,
    pub hours: Vec<HourView>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListeningCalendar {
    pub days: Vec<DayView>,
}

/// A request error the handler should report as 400 rather than 500.
#[derive(Debug)]
pub struct BadRequest(pub String);

impl std::fmt::Display for BadRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for BadRequest {}

#[async_trait]
pub trait ListeningRepo {
    async fn get_today(
        &self,
        viewer: Option<&str>,
        tz: Option<&str>,
        limit: Option<i32>,
    ) -> anyhow::Result<TodayView>;
    async fn get_reactions(
        &self,
        subject: &str,
        viewer: Option<&str>,
        emoji: Option<&str>,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<ReactionsPage>;
    async fn reaction_summaries(
        &self,
        subjects: &[String],
        viewer: Option<&str>,
    ) -> anyhow::Result<HashMap<String, Vec<ReactionSummary>>>;
    async fn get_taste_match(&self, actor: &str, viewer: &str) -> anyhow::Result<TasteMatchView>;
    async fn get_listening_calendar(
        &self,
        actor: &str,
        from: &str,
        to: &str,
        tz: Option<&str>,
    ) -> anyhow::Result<ListeningCalendar>;
}

fn dt(value: time::OffsetDateTime) -> Datetime {
    utc_to_atrium_datetime(time_to_chrono_utc(value))
}

/// Status records and plays store MusicBrainz IDs as `mbid:<uuid>` or a bare uuid.
pub(crate) fn parse_mbid(value: Option<&str>) -> Option<Uuid> {
    let value = value?.trim();
    Uuid::parse_str(value.strip_prefix("mbid:").unwrap_or(value)).ok()
}

/// The first artist name from a play's `artist_names_raw` (a JSON array of strings).
fn first_artist(raw: Option<&Value>) -> Option<String> {
    raw?.as_array()?
        .iter()
        .find_map(|v| v.as_str().map(str::to_string))
}

pub(crate) fn taste_level(shared: i64, compared: i64) -> &'static str {
    if compared == 0 {
        return "low";
    }
    let ratio = shared as f64 / compared as f64;
    if ratio >= 0.3 {
        "high"
    } else if ratio >= 0.1 {
        "some"
    } else {
        "low"
    }
}

/// Today's listeners against the daily average of the previous week, as a percentage change.
/// Releases with no history are compared with half a listener a day so they don't divide by zero.
pub(crate) fn change_percent(today: i64, weekly_daily_average: f64) -> i32 {
    let base = weekly_daily_average.max(0.5);
    (((today as f64 - base) / base) * 100.0).round() as i32
}

async fn valid_tz(repo: &PgDataSource, tz: Option<&str>) -> anyhow::Result<String> {
    let tz = tz.unwrap_or("UTC");
    let known = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = $1)",
    )
    .bind(tz)
    .fetch_one(&repo.db)
    .await?;
    if known {
        Ok(tz.to_string())
    } else {
        Err(BadRequest(format!("unknown time zone: {tz}")).into())
    }
}

async fn day_start(repo: &PgDataSource, tz: &str) -> anyhow::Result<time::OffsetDateTime> {
    Ok(sqlx::query_scalar::<_, time::OffsetDateTime>(
        "SELECT date_trunc('day', NOW() AT TIME ZONE $1) AT TIME ZONE $1",
    )
    .bind(tz)
    .fetch_one(&repo.db)
    .await?)
}

pub(crate) async fn mini_profiles(
    repo: &PgDataSource,
    dids: &[String],
) -> anyhow::Result<HashMap<String, MiniProfileView>> {
    if dids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT did, handle, display_name, avatar FROM profiles WHERE did = ANY($1)",
    )
    .bind(dids)
    .fetch_all(&repo.db)
    .await?;
    let mut found: HashMap<String, MiniProfileView> = rows
        .into_iter()
        .filter_map(|(did, handle, name, avatar)| {
            mini_profile(Some(did.clone()), handle, name, avatar).map(|p| (did, p))
        })
        .collect();
    // Accounts without an indexed teal profile still get a DID-only view.
    for did in dids {
        if !found.contains_key(did) {
            if let Some(profile) = mini_profile(Some(did.clone()), None, None, None) {
                found.insert(did.clone(), profile);
            }
        }
    }
    Ok(found)
}

#[derive(sqlx::FromRow)]
struct CircleRow {
    did: String,
    play_uri: Option<String>,
    play_cid: Option<String>,
    track_name: Option<String>,
    recording_mbid: Option<Uuid>,
    release_mbid: Option<Uuid>,
    release_name: Option<String>,
    played_time: Option<time::OffsetDateTime>,
    artist_names_raw: Option<Value>,
    status_uri: Option<String>,
    status_cid: Option<String>,
    status_record: Option<Value>,
    status_time: Option<time::OffsetDateTime>,
}

/// The track a circle member is shown with: their unexpired status when it is newer than
/// their latest play (scrobblers write the play only once a track is mostly heard),
/// otherwise the latest play.
struct Shown {
    did: String,
    subject_uri: String,
    subject_cid: Option<String>,
    track_name: String,
    artist_name: Option<String>,
    recording_mbid: Option<Uuid>,
    release_mbid: Option<Uuid>,
    release_name: Option<String>,
    time: time::OffsetDateTime,
    has_status: bool,
}

fn shown_track(row: CircleRow) -> Option<Shown> {
    let status_is_newer = match (row.status_time, row.played_time) {
        (Some(status), Some(play)) => status > play,
        (Some(_), None) => true,
        _ => false,
    };
    let has_status = row.status_uri.is_some();
    if status_is_newer {
        let item = row.status_record.as_ref()?.get("item")?;
        let artist = item
            .get("artists")
            .and_then(Value::as_array)
            .and_then(|a| a.first())
            .and_then(|a| a.get("artistName"))
            .and_then(Value::as_str)
            .map(str::to_string);
        return Some(Shown {
            did: row.did,
            subject_uri: row.status_uri?,
            subject_cid: row.status_cid,
            track_name: item.get("trackName")?.as_str()?.to_string(),
            artist_name: artist,
            recording_mbid: parse_mbid(item.get("recordingMbId").and_then(Value::as_str)),
            release_mbid: parse_mbid(item.get("releaseMbId").and_then(Value::as_str)),
            release_name: item
                .get("releaseName")
                .and_then(Value::as_str)
                .map(str::to_string),
            time: row.status_time?,
            has_status,
        });
    }
    Some(Shown {
        did: row.did,
        subject_uri: row.play_uri?,
        subject_cid: row.play_cid,
        track_name: row.track_name?,
        artist_name: first_artist(row.artist_names_raw.as_ref()),
        recording_mbid: row.recording_mbid,
        release_mbid: row.release_mbid,
        release_name: row.release_name,
        time: row.played_time?,
        has_status,
    })
}

#[derive(sqlx::FromRow)]
struct MomentRow {
    release_mbid: Uuid,
    release_name: Option<String>,
    artist_names_raw: Option<Value>,
    listener_count: i64,
    listener_dids: Option<Vec<String>>,
    weekly_average: Option<f64>,
}

impl PgDataSource {
    async fn circle_listening(
        &self,
        viewer: &str,
        start: time::OffsetDateTime,
        limit: i64,
    ) -> anyhow::Result<Vec<ListeningView>> {
        let sql = format!(
            r#"
                SELECT
                    f.subject_did AS did,
                    lp.uri AS play_uri, lp.cid AS play_cid, lp.track_name, lp.recording_mbid,
                    lp.release_mbid, lp.release_name, lp.played_time, lp.artist_names_raw,
                    st.uri AS status_uri, st.cid AS status_cid, st.record AS status_record,
                    st.status_time
                FROM social_follows f
                LEFT JOIN LATERAL (
                    SELECT uri, cid, track_name, recording_mbid, release_mbid, release_name,
                           played_time, artist_names_raw
                    FROM plays
                    WHERE did = f.subject_did AND played_time >= NOW() - INTERVAL '{LISTENING_WINDOW}'
                    ORDER BY played_time DESC
                    LIMIT 1
                ) lp ON TRUE
                LEFT JOIN LATERAL (
                    SELECT uri, cid, record, status_time
                    FROM statii
                    WHERE did = f.subject_did AND expires_at > NOW()
                    ORDER BY status_time DESC NULLS LAST, indexed_at DESC
                    LIMIT 1
                ) st ON TRUE
                WHERE f.did = $1 AND (lp.uri IS NOT NULL OR st.uri IS NOT NULL)
            "#
        );
        let rows = sqlx::query_as::<_, CircleRow>(&sql)
            .bind(viewer)
            .fetch_all(&self.db)
            .await?;

        let now = time::OffsetDateTime::now_utc();
        // A play this recent counts as listening now even without a status record.
        let now_window = time::Duration::minutes(10);
        let mut shown: Vec<(Shown, bool)> = rows
            .into_iter()
            .filter_map(shown_track)
            .map(|s| {
                let listening_now = s.has_status || now - s.time <= now_window;
                (s, listening_now)
            })
            .collect();
        shown.sort_by(|(a, a_now), (b, b_now)| b_now.cmp(a_now).then(b.time.cmp(&a.time)));
        shown.truncate(limit as usize);
        if shown.is_empty() {
            return Ok(Vec::new());
        }

        let dids: Vec<String> = shown.iter().map(|(s, _)| s.did.clone()).collect();
        let recordings: Vec<Option<Uuid>> = shown.iter().map(|(s, _)| s.recording_mbid).collect();
        let releases: Vec<Option<Uuid>> = shown.iter().map(|(s, _)| s.release_mbid).collect();
        let tracks: Vec<String> = shown.iter().map(|(s, _)| s.track_name.clone()).collect();
        let counts = sqlx::query_as::<_, (i64, i64, i64, bool)>(
            r#"
                SELECT
                    x.idx,
                    (
                        SELECT COUNT(*) FROM plays t
                        WHERE t.did = x.did AND t.played_time >= $5
                          AND CASE WHEN x.rec IS NOT NULL THEN t.recording_mbid = x.rec
                                   ELSE t.track_name = x.track END
                    ),
                    (
                        SELECT COUNT(*) FROM plays t
                        WHERE x.rel IS NOT NULL AND t.did = x.did AND t.release_mbid = x.rel
                          AND t.played_time >= $5
                    ),
                    (
                        x.rel IS NOT NULL AND NOT EXISTS (
                            SELECT 1 FROM plays t
                            WHERE t.did = x.did AND t.release_mbid = x.rel AND t.played_time < $5
                        )
                    )
                FROM unnest($1::text[], $2::uuid[], $3::uuid[], $4::text[])
                    WITH ORDINALITY AS x(did, rec, rel, track, idx)
            "#,
        )
        .bind(&dids)
        .bind(&recordings)
        .bind(&releases)
        .bind(&tracks)
        .bind(start)
        .fetch_all(&self.db)
        .await?;
        let counts: HashMap<i64, (i64, i64, bool)> = counts
            .into_iter()
            .map(|(idx, track, release, first)| (idx, (track, release, first)))
            .collect();

        let profiles = mini_profiles(self, &dids).await?;
        let subjects: Vec<String> = shown.iter().map(|(s, _)| s.subject_uri.clone()).collect();
        let mut reactions = self.reaction_summaries(&subjects, Some(viewer)).await?;

        Ok(shown
            .into_iter()
            .enumerate()
            .map(|(i, (s, listening_now))| {
                let (track, release, first) =
                    counts.get(&(i as i64 + 1)).copied().unwrap_or_default();
                ListeningView {
                    actor: profiles.get(&s.did).cloned(),
                    reactions: reactions.remove(&s.subject_uri).unwrap_or_default(),
                    play_uri: s.subject_uri,
                    play_cid: s.subject_cid,
                    track_name: s.track_name,
                    artist_name: s.artist_name,
                    recording_mb_id: s.recording_mbid.map(|id| id.to_string()),
                    release_mb_id: s.release_mbid.map(|id| id.to_string()),
                    release_name: s.release_name,
                    played_time: dt(s.time),
                    listening_now,
                    track_plays_today: track as i32,
                    release_plays_today: release as i32,
                    first_release_listen: first,
                }
            })
            .collect())
    }

    async fn moments_from_rows(
        &self,
        kind: &'static str,
        rows: Vec<MomentRow>,
        viewer: Option<&str>,
    ) -> anyhow::Result<Vec<MomentView>> {
        // Show only faces the viewer follows; the count still covers everyone.
        let followed: Vec<String> = match viewer {
            Some(viewer) => sqlx::query_scalar::<_, String>(
                "SELECT subject_did FROM social_follows WHERE did = $1",
            )
            .bind(viewer)
            .fetch_all(&self.db)
            .await?,
            None => Vec::new(),
        };
        let all_dids: Vec<String> = rows
            .iter()
            .flat_map(|r| r.listener_dids.clone().unwrap_or_default())
            .filter(|did| followed.contains(did))
            .collect();
        let profiles = mini_profiles(self, &all_dids).await?;
        Ok(rows
            .into_iter()
            .map(|row| MomentView {
                kind,
                listeners: row
                    .listener_dids
                    .unwrap_or_default()
                    .iter()
                    .filter_map(|did| profiles.get(did).cloned())
                    .take(5)
                    .collect(),
                listener_count: row.listener_count as i32,
                change_percent: row
                    .weekly_average
                    .map(|avg| change_percent(row.listener_count, avg)),
                release: ReleaseSummary {
                    release_mb_id: Some(row.release_mbid.to_string()),
                    release_name: row.release_name.unwrap_or_default(),
                    artist_name: first_artist(row.artist_names_raw.as_ref()),
                },
            })
            .collect())
    }

    async fn group_moments(
        &self,
        viewer: Option<&str>,
        start: time::OffsetDateTime,
    ) -> anyhow::Result<Vec<MomentView>> {
        let mut moments = Vec::new();

        if let Some(viewer) = viewer {
            let sql = format!(
                r#"
                    WITH mutuals AS (
                        SELECT f.subject_did AS did
                        FROM social_follows f
                        JOIN social_follows back ON back.did = f.subject_did AND back.subject_did = f.did
                        WHERE f.did = $1
                    ),
                    latest AS (
                        SELECT DISTINCT ON (p.did) p.did, p.release_mbid, p.release_name, p.artist_names_raw
                        FROM plays p
                        JOIN mutuals m ON m.did = p.did
                        WHERE p.played_time >= NOW() - INTERVAL '{MUTUALS_WINDOW}'
                          AND p.release_mbid IS NOT NULL
                        ORDER BY p.did, p.played_time DESC
                    )
                    SELECT release_mbid, MAX(release_name) AS release_name,
                           (ARRAY_AGG(artist_names_raw))[1] AS artist_names_raw,
                           COUNT(*) AS listener_count, ARRAY_AGG(did) AS listener_dids,
                           NULL::float8 AS weekly_average
                    FROM latest
                    GROUP BY release_mbid
                    HAVING COUNT(*) >= 2
                    ORDER BY listener_count DESC
                    LIMIT 2
                "#
            );
            let rows = sqlx::query_as::<_, MomentRow>(&sql)
                .bind(viewer)
                .fetch_all(&self.db)
                .await?;
            moments.extend(self.moments_from_rows("mutuals", rows, Some(viewer)).await?);
        }

        let sql = format!(
            r#"
                SELECT release_mbid, MAX(release_name) AS release_name,
                       (ARRAY_AGG(artist_names_raw ORDER BY played_time DESC))[1] AS artist_names_raw,
                       COUNT(DISTINCT did) AS listener_count,
                       (ARRAY_AGG(DISTINCT did))[1:50] AS listener_dids,
                       NULL::float8 AS weekly_average
                FROM plays
                WHERE played_time >= NOW() - INTERVAL '{NETWORK_WINDOW}' AND release_mbid IS NOT NULL
                GROUP BY release_mbid
                HAVING COUNT(DISTINCT did) >= 2
                ORDER BY listener_count DESC
                LIMIT 1
            "#
        );
        let rows = sqlx::query_as::<_, MomentRow>(&sql)
            .fetch_all(&self.db)
            .await?;
        moments.extend(self.moments_from_rows("network", rows, viewer).await?);

        let rows = sqlx::query_as::<_, MomentRow>(
            r#"
                WITH today AS (
                    SELECT release_mbid, MAX(release_name) AS release_name,
                           (ARRAY_AGG(artist_names_raw))[1] AS artist_names_raw,
                           COUNT(DISTINCT did) AS listener_count,
                           (ARRAY_AGG(DISTINCT did))[1:50] AS listener_dids
                    FROM plays
                    WHERE played_time >= $1 AND release_mbid IS NOT NULL
                    GROUP BY release_mbid
                ),
                week AS (
                    SELECT release_mbid,
                           COUNT(DISTINCT (did, date_trunc('day', played_time)))::float8 / 7 AS weekly_average
                    FROM plays
                    WHERE played_time >= $1 - INTERVAL '7 days' AND played_time < $1
                      AND release_mbid IS NOT NULL
                    GROUP BY release_mbid
                )
                SELECT t.release_mbid, t.release_name, t.artist_names_raw, t.listener_count,
                       t.listener_dids, COALESCE(w.weekly_average, 0) AS weekly_average
                FROM today t
                LEFT JOIN week w USING (release_mbid)
                WHERE t.listener_count >= 3
                ORDER BY t.listener_count / GREATEST(COALESCE(w.weekly_average, 0), 0.5) DESC,
                         t.listener_count DESC
                LIMIT 1
            "#,
        )
        .bind(start)
        .fetch_all(&self.db)
        .await?;
        moments.extend(self.moments_from_rows("trending", rows, viewer).await?);

        Ok(moments)
    }

    async fn heating_up(
        &self,
        viewer: Option<&str>,
        start: time::OffsetDateTime,
    ) -> anyhow::Result<Vec<MomentView>> {
        // With a viewer this is their circle; without one, the whole network.
        let rows = sqlx::query_as::<_, MomentRow>(
            r#"
                SELECT p.release_mbid, MAX(p.release_name) AS release_name,
                       (ARRAY_AGG(p.artist_names_raw))[1] AS artist_names_raw,
                       COUNT(DISTINCT p.did) AS listener_count,
                       (ARRAY_AGG(DISTINCT p.did))[1:50] AS listener_dids,
                       NULL::float8 AS weekly_average
                FROM plays p
                WHERE p.played_time >= $1 AND p.release_mbid IS NOT NULL
                  AND ($2::text IS NULL OR p.did IN (
                      SELECT subject_did FROM social_follows WHERE did = $2
                  ))
                GROUP BY p.release_mbid
                HAVING COUNT(DISTINCT p.did) >= 2
                ORDER BY listener_count DESC, MAX(p.played_time) DESC
                LIMIT 5
            "#,
        )
        .bind(start)
        .bind(viewer)
        .fetch_all(&self.db)
        .await?;
        let kind = if viewer.is_some() { "circle" } else { "network" };
        self.moments_from_rows(kind, rows, viewer).await
    }
}

#[derive(sqlx::FromRow)]
struct ReactionRow {
    uri: String,
    emoji: String,
    did: String,
    created_at: time::OffsetDateTime,
    handle: Option<String>,
    display_name: Option<String>,
    avatar: Option<String>,
}

#[derive(sqlx::FromRow)]
struct TopArtistRow {
    name: String,
    release_mbid: Option<Uuid>,
    release_name: Option<String>,
}

#[async_trait]
impl ListeningRepo for PgDataSource {
    async fn get_today(
        &self,
        viewer: Option<&str>,
        tz: Option<&str>,
        limit: Option<i32>,
    ) -> anyhow::Result<TodayView> {
        let tz = valid_tz(self, tz).await?;
        let start = day_start(self, &tz).await?;
        let limit = limit.unwrap_or(12).clamp(1, 30) as i64;
        let listening = match viewer {
            Some(viewer) => self.circle_listening(viewer, start, limit).await?,
            None => Vec::new(),
        };
        Ok(TodayView {
            listening,
            moments: self.group_moments(viewer, start).await?,
            heating_up: self.heating_up(viewer, start).await?,
        })
    }

    async fn reaction_summaries(
        &self,
        subjects: &[String],
        viewer: Option<&str>,
    ) -> anyhow::Result<HashMap<String, Vec<ReactionSummary>>> {
        if subjects.is_empty() {
            return Ok(HashMap::new());
        }
        let rows = sqlx::query_as::<_, (String, String, i64, Option<String>)>(
            r#"
                SELECT subject_uri, emoji, COUNT(*),
                       MAX(uri) FILTER (WHERE did = $2)
                FROM social_reactions
                WHERE subject_uri = ANY($1)
                GROUP BY subject_uri, emoji
                ORDER BY subject_uri, COUNT(*) DESC, MIN(created_at)
            "#,
        )
        .bind(subjects)
        .bind(viewer)
        .fetch_all(&self.db)
        .await?;
        let mut out: HashMap<String, Vec<ReactionSummary>> = HashMap::new();
        for (subject, emoji, count, viewer_reaction) in rows {
            out.entry(subject).or_default().push(ReactionSummary {
                emoji,
                count: count as i32,
                viewer_reaction,
            });
        }
        Ok(out)
    }

    async fn get_reactions(
        &self,
        subject: &str,
        viewer: Option<&str>,
        emoji: Option<&str>,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<ReactionsPage> {
        let limit = limit.unwrap_or(50).clamp(1, 100) as i64;
        let offset = crate::repos::stats::decode_offset_cursor(cursor)?;
        let rows = sqlx::query_as::<_, ReactionRow>(
            r#"
                SELECT r.uri, r.emoji, r.did, r.created_at,
                       p.handle, p.display_name, p.avatar
                FROM social_reactions r
                LEFT JOIN profiles p ON p.did = r.did
                WHERE r.subject_uri = $1 AND ($2::text IS NULL OR r.emoji = $2)
                ORDER BY r.created_at DESC
                LIMIT $3 OFFSET $4
            "#,
        )
        .bind(subject)
        .bind(emoji)
        .bind(limit + 1)
        .bind(offset)
        .fetch_all(&self.db)
        .await?;
        let cursor = if rows.len() > limit as usize {
            Some(crate::repos::stats::encode_offset_cursor(offset + limit)?)
        } else {
            None
        };
        let mut summaries = self
            .reaction_summaries(&[subject.to_string()], viewer)
            .await?;
        Ok(ReactionsPage {
            summary: summaries.remove(subject).unwrap_or_default(),
            reactions: rows
                .into_iter()
                .take(limit as usize)
                .map(|row| ReactionView {
                    actor: mini_profile(
                        Some(row.did.clone()),
                        row.handle,
                        row.display_name,
                        row.avatar,
                    ),
                    uri: row.uri,
                    emoji: row.emoji,
                    actor_did: row.did,
                    created_at: dt(row.created_at),
                })
                .collect(),
            cursor,
        })
    }

    async fn get_taste_match(&self, actor: &str, viewer: &str) -> anyhow::Result<TasteMatchView> {
        let actor = resolve_actor_to_did(self, actor).await?;
        let top_sql = format!(
            r#"
                WITH ranked AS (
                    SELECT LOWER(pa.artist_name) AS key, MIN(pa.artist_name) AS name, COUNT(*) AS n
                    FROM plays p
                    JOIN play_to_artists_extended pa ON pa.play_uri = p.uri
                    WHERE p.did = $1 AND p.played_time >= NOW() - INTERVAL '{TASTE_WINDOW}'
                    GROUP BY LOWER(pa.artist_name)
                    ORDER BY n DESC
                    LIMIT $2
                )
                SELECT r.name, rel.release_mbid, rel.release_name
                FROM ranked r
                LEFT JOIN LATERAL (
                    SELECT p.release_mbid, MAX(p.release_name) AS release_name
                    FROM plays p
                    JOIN play_to_artists_extended pa ON pa.play_uri = p.uri
                    WHERE p.did = $1 AND LOWER(pa.artist_name) = r.key AND p.release_mbid IS NOT NULL
                    GROUP BY p.release_mbid
                    ORDER BY COUNT(*) DESC
                    LIMIT 1
                ) rel ON TRUE
                ORDER BY r.n DESC
            "#
        );
        let actor_top = sqlx::query_as::<_, TopArtistRow>(&top_sql)
            .bind(&actor)
            .bind(TOP_ARTIST_COUNT)
            .fetch_all(&self.db)
            .await?;
        let viewer_top = sqlx::query_as::<_, TopArtistRow>(&top_sql)
            .bind(viewer)
            .bind(TOP_ARTIST_COUNT)
            .fetch_all(&self.db)
            .await?;
        let viewer_keys: Vec<String> = viewer_top.iter().map(|a| a.name.to_lowercase()).collect();
        let shared: Vec<SharedArtist> = actor_top
            .into_iter()
            .filter(|a| viewer_keys.contains(&a.name.to_lowercase()))
            .map(|a| SharedArtist {
                name: a.name,
                release_mb_id: a.release_mbid.map(|id| id.to_string()),
                release_name: a.release_name,
            })
            .collect();
        let compared = TOP_ARTIST_COUNT.min(viewer_keys.len() as i64);
        let shared_count = shared.len() as i64;

        let suggestion = sqlx::query_as::<_, (Uuid, Option<String>, Option<Value>, i64)>(
            r#"
                WITH ranked AS (
                    SELECT release_mbid, MAX(release_name) AS release_name,
                           (ARRAY_AGG(artist_names_raw))[1] AS artist_names_raw,
                           ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS rank
                    FROM plays
                    WHERE did = $1 AND played_time >= NOW() - INTERVAL '30 days'
                      AND release_mbid IS NOT NULL
                    GROUP BY release_mbid
                )
                SELECT r.release_mbid, r.release_name, r.artist_names_raw, r.rank
                FROM ranked r
                WHERE r.rank <= 10 AND NOT EXISTS (
                    SELECT 1 FROM plays v WHERE v.did = $2 AND v.release_mbid = r.release_mbid
                )
                ORDER BY r.rank
                LIMIT 1
            "#,
        )
        .bind(&actor)
        .bind(viewer)
        .fetch_optional(&self.db)
        .await?
        .map(|(mbid, name, artists, rank)| TasteSuggestion {
            release_mb_id: Some(mbid.to_string()),
            release_name: name.unwrap_or_default(),
            artist_name: first_artist(artists.as_ref()),
            rank: rank as i32,
        });

        Ok(TasteMatchView {
            level: taste_level(shared_count, compared),
            shared_artist_count: shared_count as i32,
            top_artist_count: compared as i32,
            shared_artists: shared.into_iter().take(8).collect(),
            suggestion,
        })
    }

    async fn get_listening_calendar(
        &self,
        actor: &str,
        from: &str,
        to: &str,
        tz: Option<&str>,
    ) -> anyhow::Result<ListeningCalendar> {
        let format = time::macros::format_description!("[year]-[month]-[day]");
        let from_date = time::Date::parse(from, &format)
            .map_err(|_| BadRequest(format!("from must be YYYY-MM-DD, got {from}")))?;
        let to_date = time::Date::parse(to, &format)
            .map_err(|_| BadRequest(format!("to must be YYYY-MM-DD, got {to}")))?;
        let span = (to_date - from_date).whole_days();
        if !(0..MAX_CALENDAR_DAYS).contains(&span) {
            return Err(BadRequest(format!(
                "to must be on or after from and at most {MAX_CALENDAR_DAYS} days later"
            ))
            .into());
        }
        let tz = valid_tz(self, tz).await?;
        let actor = resolve_actor_to_did(self, actor).await?;

        // Shared bucket CTE: each play with its local day and hour.
        let buckets = r#"
            WITH b AS (
                SELECT (p.played_time AT TIME ZONE $4)::date AS d,
                       EXTRACT(HOUR FROM p.played_time AT TIME ZONE $4)::int AS h,
                       p.release_mbid, p.release_name, p.artist_names_raw
                FROM plays p
                WHERE p.did = $1
                  AND p.played_time >= ($2::date::timestamp AT TIME ZONE $4)
                  AND p.played_time < (($3::date + 1)::timestamp AT TIME ZONE $4)
            )
        "#;
        let hours = sqlx::query_as::<_, (time::Date, i32, i64, Option<Uuid>)>(&format!(
            r#"{buckets},
            counts AS (SELECT d, h, COUNT(*) AS n FROM b GROUP BY d, h),
            top AS (
                SELECT DISTINCT ON (d, h) d, h, release_mbid
                FROM b WHERE release_mbid IS NOT NULL
                GROUP BY d, h, release_mbid
                ORDER BY d, h, COUNT(*) DESC, release_mbid
            )
            SELECT c.d, c.h, c.n, t.release_mbid
            FROM counts c LEFT JOIN top t USING (d, h)
            ORDER BY c.d, c.h"#
        ))
        .bind(&actor)
        .bind(from_date)
        .bind(to_date)
        .bind(&tz)
        .fetch_all(&self.db)
        .await?;
        let tops = sqlx::query_as::<_, (time::Date, Uuid, Option<String>, Option<Value>)>(
            &format!(
                r#"{buckets}
                SELECT DISTINCT ON (d) d, release_mbid, MAX(release_name), (ARRAY_AGG(artist_names_raw))[1]
                FROM b WHERE release_mbid IS NOT NULL
                GROUP BY d, release_mbid
                ORDER BY d, COUNT(*) DESC, release_mbid"#
            ),
        )
        .bind(&actor)
        .bind(from_date)
        .bind(to_date)
        .bind(&tz)
        .fetch_all(&self.db)
        .await?;

        let mut tops: HashMap<time::Date, ReleaseSummary> = tops
            .into_iter()
            .map(|(d, mbid, name, artists)| {
                (
                    d,
                    ReleaseSummary {
                        release_mb_id: Some(mbid.to_string()),
                        release_name: name.unwrap_or_default(),
                        artist_name: first_artist(artists.as_ref()),
                    },
                )
            })
            .collect();
        let mut by_day: HashMap<time::Date, Vec<HourView>> = HashMap::new();
        for (d, h, n, release) in hours {
            by_day.entry(d).or_default().push(HourView {
                hour: h,
                play_count: n as i32,
                release_mb_id: release.map(|id| id.to_string()),
            });
        }

        let mut days = Vec::new();
        let mut day = from_date;
        while day <= to_date {
            let hours = by_day.remove(&day).unwrap_or_default();
            days.push(DayView {
                date: day.format(&format).map_err(|e| anyhow!(e))?,
                play_count: hours.iter().map(|h| h.play_count).sum(),
                top_release: tops.remove(&day),
                hours,
            });
            day = day.next_day().ok_or_else(|| anyhow!("date overflow"))?;
        }
        Ok(ListeningCalendar { days })
    }
}

#[cfg(test)]
mod tests {
    use super::{change_percent, first_artist, parse_mbid, taste_level};
    use serde_json::json;

    #[test]
    fn grades_taste_overlap() {
        assert_eq!(taste_level(8, 20), "high");
        assert_eq!(taste_level(3, 20), "some");
        assert_eq!(taste_level(1, 20), "low");
        assert_eq!(taste_level(0, 0), "low");
    }

    #[test]
    fn computes_trending_change_against_weekly_average() {
        assert_eq!(change_percent(9, 2.0), 350);
        assert_eq!(change_percent(3, 0.0), 500);
        assert_eq!(change_percent(2, 2.0), 0);
    }

    #[test]
    fn reads_mbids_and_artists_in_either_shape() {
        let id = "32c1f062-e510-4cbe-9d71-cb72632f1771";
        assert_eq!(parse_mbid(Some(&format!("mbid:{id}"))).unwrap().to_string(), id);
        assert_eq!(parse_mbid(Some(id)).unwrap().to_string(), id);
        assert!(parse_mbid(Some("not-an-id")).is_none());
        assert_eq!(first_artist(Some(&json!(["Blur", "Damon"]))).as_deref(), Some("Blur"));
        assert_eq!(first_artist(Some(&json!({}))), None);
    }

    /// Builds a tiny circle at the current time (the local dev data is weeks old) and checks
    /// every listening endpoint against it, cleaning up afterwards.
    #[tokio::test]
    #[ignore = "requires DATABASE_URL pointing at a migrated Postgres database"]
    async fn serves_today_reactions_taste_and_calendar() -> anyhow::Result<()> {
        use super::{ListeningRepo, PgDataSource};
        use sqlx::PgPool;
        use uuid::Uuid;

        let pool = PgPool::connect(&std::env::var("DATABASE_URL")?).await?;
        let repo = PgDataSource::new(pool.clone());
        let tag = Uuid::new_v4().simple().to_string();
        let did = |name: &str| format!("did:plc:today-{name}-{tag}");
        let (viewer, ana, jo, mika) = (did("viewer"), did("ana"), did("jo"), did("mika"));
        let (release, recording, other_release) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());

        let result = async {
            for (mbid, name) in [(release, "Be the Cowboy"), (other_release, "Charm")] {
                sqlx::query("INSERT INTO releases (mbid, name) VALUES ($1, $2)")
                    .bind(mbid).bind(name).execute(&pool).await?;
            }
            sqlx::query("INSERT INTO recordings (mbid, name) VALUES ($1, 'Nobody')")
                .bind(recording).execute(&pool).await?;
            // viewer follows all three; ana and jo follow back (mutuals), mika does not.
            for (from, to) in [(&viewer, &ana), (&viewer, &jo), (&viewer, &mika), (&ana, &viewer), (&jo, &viewer)] {
                sqlx::query(
                    "INSERT INTO social_follows (uri, did, rkey, cid, subject_did, created_at, record)
                     VALUES ($1, $2, $3, 'cid', $4, NOW(), '{}')",
                )
                .bind(format!("at://{from}/fm.teal.graph.follow/{}", Uuid::new_v4().simple()))
                .bind(from).bind(Uuid::new_v4().simple().to_string()).bind(to)
                .execute(&pool).await?;
            }
            let play = |who: &str, n: u8| format!("at://{who}/fm.teal.feed.play/{n}");
            for (who, n, minutes, release_mbid, recording_mbid) in [
                (&ana, 1, 2, release, Some(recording)),
                (&jo, 1, 5, release, Some(recording)),
                (&mika, 1, 60, other_release, None),
                (&viewer, 1, 600, other_release, None),
            ] {
                sqlx::query(
                    "INSERT INTO plays (uri, did, rkey, cid, track_name, played_time, release_mbid,
                                        release_name, recording_mbid, artist_names_raw)
                     VALUES ($1, $2, $3, $4, 'Nobody', NOW() - make_interval(mins => $5), $6,
                             (SELECT name FROM releases WHERE mbid = $6), $7, '[\"Mitski\"]')",
                )
                .bind(play(who, n)).bind(who).bind(n.to_string()).bind(format!("cid-{who}"))
                .bind(minutes).bind(release_mbid).bind(recording_mbid)
                .execute(&pool).await?;
            }
            sqlx::query(
                "INSERT INTO statii (uri, did, rkey, cid, record, status_time, expires_at)
                 VALUES ($1, $2, 'self', 'status-cid', $3, NOW(), NOW() + INTERVAL '10 minutes')",
            )
            .bind(format!("at://{mika}/fm.teal.actor.status/self"))
            .bind(&mika)
            .bind(serde_json::json!({"item": {"trackName": "Sexy to Someone", "artists": [{"artistName": "Clairo"}],
                                     "releaseName": "Charm", "releaseMbId": format!("mbid:{other_release}")}}))
            .execute(&pool).await?;
            sqlx::query(
                "INSERT INTO social_reactions (uri, did, rkey, cid, subject_uri, subject_cid, emoji, created_at, record)
                 VALUES ($1, $2, 'r1', 'cid', $3, $4, '🔥', NOW(), '{}')",
            )
            .bind(format!("at://{viewer}/fm.teal.feed.social.reaction/r1"))
            .bind(&viewer).bind(play(&ana, 1)).bind(format!("cid-{ana}"))
            .execute(&pool).await?;
            let artist_id: i32 = sqlx::query_scalar(
                "INSERT INTO artists_extended (name) VALUES ($1) RETURNING id",
            )
            .bind(format!("Mitski {tag}"))
            .fetch_one(&pool).await?;
            for who in [&ana, &viewer] {
                sqlx::query("INSERT INTO play_to_artists_extended (play_uri, artist_id, artist_name) VALUES ($1, $2, $3)")
                    .bind(play(who, 1)).bind(artist_id).bind(format!("Mitski {tag}"))
                    .execute(&pool).await?;
            }

            let today = repo.get_today(Some(&viewer), Some("UTC"), None).await?;
            let names: Vec<String> = today.listening.iter()
                .map(|l| l.actor.as_ref().and_then(|a| a.did.as_ref()).map(|d| d.to_string()).unwrap_or_default())
                .collect();
            assert_eq!(names.len(), 3, "all three followed listeners appear: {names:?}");
            let ana_view = today.listening.iter().find(|l| l.play_uri == play(&ana, 1)).expect("ana listed");
            assert!(ana_view.listening_now);
            assert_eq!(ana_view.track_plays_today, 1);
            assert!(ana_view.first_release_listen);
            assert_eq!(ana_view.reactions[0].emoji, "🔥");
            assert!(ana_view.reactions[0].viewer_reaction.is_some());
            let mika_view = today.listening.iter().find(|l| l.play_uri.contains("fm.teal.actor.status")).expect("mika shown from status");
            assert_eq!(mika_view.track_name, "Sexy to Someone");
            assert!(mika_view.listening_now);
            let mutuals = today.moments.iter().find(|m| m.kind == "mutuals").expect("mutuals moment");
            assert_eq!(mutuals.listener_count, 2);
            assert_eq!(mutuals.release.release_name, "Be the Cowboy");

            let reactions = repo.get_reactions(&play(&ana, 1), Some(&viewer), None, None, None).await?;
            assert_eq!(reactions.summary[0].count, 1);
            assert_eq!(reactions.reactions.len(), 1);

            let taste = repo.get_taste_match(&ana, &viewer).await?;
            assert_eq!(taste.shared_artist_count, 1);

            let day = time::OffsetDateTime::now_utc().date();
            let date = format!("{}-{:02}-{:02}", day.year(), u8::from(day.month()), day.day());
            let calendar = repo.get_listening_calendar(&ana, &date, &date, Some("UTC")).await?;
            assert_eq!(calendar.days.len(), 1);
            // A play two minutes ago may fall on yesterday right after UTC midnight.
            if calendar.days[0].play_count > 0 {
                assert_eq!(calendar.days[0].top_release.as_ref().map(|r| r.release_name.as_str()), Some("Be the Cowboy"));
            }
            assert!(repo.get_listening_calendar(&ana, &date, "2099-01-01", None).await.is_err());
            assert!(repo.get_today(None, Some("Not/AZone"), None).await.is_err());
            anyhow::Ok(())
        }
        .await;

        let dids = vec![viewer.clone(), ana.clone(), jo.clone(), mika.clone()];
        sqlx::query("DELETE FROM play_to_artists_extended WHERE play_uri IN (SELECT uri FROM plays WHERE did = ANY($1))").bind(&dids).execute(&pool).await?;
        sqlx::query("DELETE FROM artists_extended WHERE name = $1").bind(format!("Mitski {tag}")).execute(&pool).await?;
        for table in ["social_reactions", "statii", "plays", "social_follows"] {
            sqlx::query(&format!("DELETE FROM {table} WHERE did = ANY($1)")).bind(&dids).execute(&pool).await?;
        }
        sqlx::query("DELETE FROM recordings WHERE mbid = $1").bind(recording).execute(&pool).await?;
        sqlx::query("DELETE FROM releases WHERE mbid = ANY($1)").bind(vec![release, other_release]).execute(&pool).await?;
        result
    }
}
