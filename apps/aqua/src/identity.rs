//! Who an account is when Aqua hasn't indexed its profile yet.
//!
//! Cadet only learns about a teal profile when its record passes through Jetstream,
//! so accounts that set one up before ingestion started, or whose events were missed,
//! show up as bare DIDs. For those, Aqua asks the account's PDS for its teal profile
//! and stores it the way Cadet would. Accounts with no teal profile get their Bluesky
//! name and avatar, and anyone neither knows stays a DID.

use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    sync::Arc,
    time::{Duration, Instant},
};

use futures::{
    FutureExt, StreamExt,
    future::{BoxFuture, Shared},
    stream::FuturesUnordered,
};
use serde_json::Value;
use sqlx::PgPool;
use tokio::sync::{Mutex, Semaphore};
use tracing::{info, warn};

const PROFILE_COLLECTIONS: [&str; 2] = ["fm.teal.actor.profile", "fm.teal.alpha.actor.profile"];
const BLUESKY_APPVIEW: &str = "https://public.api.bsky.app";
const PLC_DIRECTORY: &str = "https://plc.directory";
/// How long a request waits for lookups; slower ones finish in the background.
const WAIT: Duration = Duration::from_millis(2500);
const FOUND_TTL: Duration = Duration::from_secs(60 * 60);
const MISSING_TTL: Duration = Duration::from_secs(10 * 60);
const FAILED_TTL: Duration = Duration::from_secs(2 * 60);
const MAX_LOOKUPS: usize = 24;
/// Lookups running at once across all requests.
const CONCURRENT_LOOKUPS: usize = 16;
/// Past this, expired entries are dropped, and if that isn't enough, everything.
const MAX_CACHED: usize = 20_000;
const HTTP_TIMEOUT: Duration = Duration::from_secs(5);

/// The name, handle, and avatar to show for an account.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ActorIdentity {
    pub handle: Option<String>,
    pub display_name: Option<String>,
    /// A blob CID for teal profiles, or a full URL from Bluesky.
    pub avatar: Option<String>,
}

#[derive(Clone)]
enum Lookup {
    Found(ActorIdentity),
    /// Nobody knows this account beyond its DID.
    Missing,
    /// A directory or PDS didn't answer, so try again soon.
    Failed,
}

type InFlight = Shared<BoxFuture<'static, Lookup>>;

pub struct ActorResolver {
    db: PgPool,
    http: reqwest::Client,
    cache: Mutex<HashMap<String, (Lookup, Instant)>>,
    /// Lookups underway, so concurrent requests for one DID share a single fetch.
    in_flight: Mutex<HashMap<String, InFlight>>,
    permits: Arc<Semaphore>,
    /// When getProfile last looked for a DID's teal profile and found none.
    profile_checks: Mutex<HashMap<String, Instant>>,
}

impl ActorResolver {
    pub fn new(db: PgPool) -> anyhow::Result<Arc<Self>> {
        Ok(Arc::new(Self {
            db,
            http: http_client(None)?,
            cache: Mutex::new(HashMap::new()),
            in_flight: Mutex::new(HashMap::new()),
            permits: Arc::new(Semaphore::new(CONCURRENT_LOOKUPS)),
            profile_checks: Mutex::new(HashMap::new()),
        }))
    }

    /// Identities for `dids`, waiting briefly for any that need a network lookup.
    /// Lookups still running when the wait ends keep going and land in the cache.
    pub async fn resolve(self: &Arc<Self>, dids: Vec<String>) -> HashMap<String, ActorIdentity> {
        let mut found = HashMap::new();
        let mut pending = Vec::new();
        {
            let cache = self.cache.lock().await;
            for did in dids {
                if !is_did(&did) || found.contains_key(&did) || pending.contains(&did) {
                    continue;
                }
                match cache.get(&did) {
                    Some((lookup, at)) if at.elapsed() < ttl(lookup) => {
                        if let Lookup::Found(identity) = lookup {
                            found.insert(did, identity.clone());
                        }
                    }
                    _ => pending.push(did),
                }
            }
        }
        pending.truncate(MAX_LOOKUPS);
        if pending.is_empty() {
            return found;
        }

        let teal_profiles = self.indexed_teal_profiles(&pending).await;
        let mut lookups: FuturesUnordered<_> = FuturesUnordered::new();
        for did in pending {
            let has_teal_profile = teal_profiles.contains(&did);
            let lookup = self.lookup_once(did.clone(), has_teal_profile).await;
            lookups.push(async move { (did, lookup.await) });
        }
        // Keep whatever finishes in time; the rest land in the cache for next time.
        let deadline = tokio::time::Instant::now() + WAIT;
        while let Ok(Some((did, lookup))) = tokio::time::timeout_at(deadline, lookups.next()).await {
            if let Lookup::Found(identity) = lookup {
                found.insert(did, identity);
            }
        }
        found
    }

    /// The lookup for `did`, joining one already underway.
    async fn lookup_once(self: &Arc<Self>, did: String, has_teal_profile: bool) -> InFlight {
        let mut in_flight = self.in_flight.lock().await;
        if let Some(lookup) = in_flight.get(&did) {
            return lookup.clone();
        }
        let resolver = Arc::clone(self);
        let key = did.clone();
        // Spawned so a lookup that outlasts this request still fills the cache.
        let task = tokio::spawn(async move {
            let lookup = match resolver.permits.clone().acquire_owned().await {
                Ok(_permit) => resolver.lookup(&key, has_teal_profile).await,
                Err(_) => Lookup::Failed,
            };
            resolver.remember(&key, lookup.clone()).await;
            resolver.in_flight.lock().await.remove(&key);
            lookup
        });
        let lookup = task.map(|result| result.unwrap_or(Lookup::Failed)).boxed().shared();
        in_flight.insert(did, lookup.clone());
        lookup
    }

    async fn remember(&self, did: &str, lookup: Lookup) {
        let mut cache = self.cache.lock().await;
        if cache.len() >= MAX_CACHED {
            cache.retain(|_, (lookup, at)| at.elapsed() < ttl(lookup));
            if cache.len() >= MAX_CACHED {
                cache.clear();
            }
        }
        cache.insert(did.to_string(), (lookup, Instant::now()));
    }

    /// Fetches and stores the teal profile for `did` if its PDS has one. Returns
    /// whether a profile was stored.
    pub async fn backfill_teal_profile(&self, did: &str) -> anyhow::Result<bool> {
        if !is_did(did) {
            return Ok(false);
        }
        // A miss is remembered, so repeated profile views can't make Aqua refetch.
        if self
            .profile_checks
            .lock()
            .await
            .get(did)
            .is_some_and(|at| at.elapsed() < MISSING_TTL)
        {
            return Ok(false);
        }
        let _permit = self.permits.acquire().await?;
        let found = match self.did_document(did).await {
            Ok(doc) => self.teal_profile(did, &doc).await?.is_some(),
            Err(_) => false,
        };
        if !found {
            let mut checks = self.profile_checks.lock().await;
            if checks.len() >= MAX_CACHED {
                checks.retain(|_, at| at.elapsed() < MISSING_TTL);
            }
            checks.insert(did.to_string(), Instant::now());
        }
        Ok(found)
    }

    async fn lookup(&self, did: &str, has_teal_profile: bool) -> Lookup {
        match self.try_lookup(did, has_teal_profile).await {
            Ok(Some(identity)) => Lookup::Found(identity),
            Ok(None) => Lookup::Missing,
            Err(error) => {
                warn!("Couldn't look up {did}: {error:#}");
                Lookup::Failed
            }
        }
    }

    async fn try_lookup(
        &self,
        did: &str,
        has_teal_profile: bool,
    ) -> anyhow::Result<Option<ActorIdentity>> {
        let doc = self.did_document(did).await.ok();
        if !has_teal_profile && let Some(doc) = &doc {
            match self.teal_profile(did, doc).await {
                Ok(Some(identity)) => return Ok(Some(identity)),
                Ok(None) => {}
                Err(error) => warn!("Couldn't read the teal profile for {did}: {error:#}"),
            }
        }

        let bluesky = self.bluesky_profile(did).await?;
        let handle = match bluesky.as_ref().and_then(|p| p.handle.clone()) {
            Some(handle) => Some(handle),
            None => match doc.as_ref().and_then(document_handle) {
                Some(handle) if self.handle_resolves_to(&handle, did).await => Some(handle),
                _ => None,
            },
        };
        if let Some(handle) = &handle {
            self.remember_handle(did, handle).await;
        }
        let identity = ActorIdentity {
            handle,
            display_name: bluesky.as_ref().and_then(|p| p.display_name.clone()),
            avatar: bluesky.and_then(|p| p.avatar),
        };
        Ok((identity != ActorIdentity::default()).then_some(identity))
    }

    /// DIDs among `dids` that already have a teal profile row, as opposed to the
    /// handle-only rows identity events leave.
    async fn indexed_teal_profiles(&self, dids: &[String]) -> Vec<String> {
        sqlx::query_scalar::<_, String>(
            "SELECT did FROM profiles WHERE did = ANY($1) AND created_at IS NOT NULL",
        )
        .bind(dids)
        .fetch_all(&self.db)
        .await
        .unwrap_or_default()
    }

    async fn did_document(&self, did: &str) -> anyhow::Result<Value> {
        let response = if did.starts_with("did:plc:") {
            self.http.get(format!("{PLC_DIRECTORY}/{did}")).send().await?
        } else if let Some(host) = did.strip_prefix("did:web:") {
            anyhow::ensure!(
                host.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-'),
                "unsupported did:web {did}"
            );
            // Anyone can name any host in a did:web, so only public ones are fetched.
            public_client(host)
                .await?
                .get(format!("https://{host}/.well-known/did.json"))
                .send()
                .await?
        } else {
            anyhow::bail!("unsupported DID method: {did}");
        };
        read_json(response.error_for_status()?).await
    }

    async fn teal_profile(&self, did: &str, doc: &Value) -> anyhow::Result<Option<ActorIdentity>> {
        let Some(pds) = pds_endpoint(doc) else {
            return Ok(None);
        };
        let host = url::Url::parse(&pds)?
            .host_str()
            .map(str::to_string)
            .ok_or_else(|| anyhow::anyhow!("PDS endpoint has no host: {pds}"))?;
        let client = public_client(&host).await?;

        for collection in PROFILE_COLLECTIONS {
            let mut url = url::Url::parse(&pds)?.join("/xrpc/com.atproto.repo.getRecord")?;
            url.query_pairs_mut()
                .append_pair("repo", did)
                .append_pair("collection", collection)
                .append_pair("rkey", "self");
            let response = client.get(url).send().await?;
            // A PDS answers 400 RecordNotFound for a collection the account never wrote.
            if response.status() == reqwest::StatusCode::BAD_REQUEST
                || response.status() == reqwest::StatusCode::NOT_FOUND
            {
                continue;
            }
            let body = read_json(response.error_for_status()?).await?;
            let Some(record) = body.get("value") else {
                continue;
            };
            let handle = match document_handle(doc) {
                Some(handle) if self.handle_resolves_to(&handle, did).await => Some(handle),
                _ => None,
            };
            self.store_teal_profile(did, handle.as_deref(), record).await?;
            info!("Backfilled the teal profile for {did} from its PDS");
            return Ok(Some(ActorIdentity {
                handle,
                display_name: string_field(record, "displayName"),
                avatar: blob_cid(record.get("avatar")),
            }));
        }
        Ok(None)
    }

    /// Writes a profile record the way Cadet's ingestor does, so a later Jetstream
    /// event for the same record lands on the same row.
    async fn store_teal_profile(
        &self,
        did: &str,
        handle: Option<&str>,
        record: &Value,
    ) -> anyhow::Result<()> {
        let created_at = string_field(record, "createdAt")
            .and_then(|at| {
                time::OffsetDateTime::parse(&at, &time::format_description::well_known::Rfc3339)
                    .ok()
            })
            .unwrap_or_else(time::OffsetDateTime::now_utc);
        // The lexicon caps favourites at four, as Cadet does.
        let favorites = record
            .get("favorites")
            .and_then(Value::as_array)
            .map(|items| Value::Array(items.iter().take(4).cloned().collect()));
        sqlx::query(
            r#"
                INSERT INTO profiles (did, handle, display_name, description, description_facets, avatar, banner, stats_default_period, created_at, favorites)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (did) DO UPDATE SET
                    handle = COALESCE(EXCLUDED.handle, profiles.handle),
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description,
                    description_facets = EXCLUDED.description_facets,
                    avatar = EXCLUDED.avatar,
                    banner = EXCLUDED.banner,
                    stats_default_period = EXCLUDED.stats_default_period,
                    created_at = EXCLUDED.created_at,
                    favorites = EXCLUDED.favorites
                -- Cadet always sets created_at, so a row that has one holds a record
                -- at least as new as this fetch, and wins.
                WHERE profiles.created_at IS NULL
            "#,
        )
        .bind(did)
        .bind(handle)
        .bind(string_field(record, "displayName"))
        .bind(string_field(record, "description"))
        .bind(record.get("descriptionFacets").cloned().unwrap_or(Value::Null))
        .bind(blob_cid(record.get("avatar")))
        .bind(blob_cid(record.get("banner")))
        .bind(string_field(record, "statsDefaultPeriod"))
        .bind(created_at)
        .bind(favorites)
        .execute(&self.db)
        .await?;
        Ok(())
    }

    /// Keeps a handle the way identity events do, without touching a teal profile's fields.
    async fn remember_handle(&self, did: &str, handle: &str) {
        let result = sqlx::query(
            "INSERT INTO profiles (did, handle) VALUES ($1, $2)
             ON CONFLICT (did) DO UPDATE SET handle = EXCLUDED.handle
             WHERE profiles.handle IS NULL",
        )
        .bind(did)
        .bind(handle)
        .execute(&self.db)
        .await;
        if let Err(error) = result {
            warn!("Couldn't store the handle for {did}: {error:#}");
        }
    }

    /// Bluesky's profile, or `None` when Bluesky doesn't know the account.
    async fn bluesky_profile(&self, did: &str) -> anyhow::Result<Option<ActorIdentity>> {
        let mut url = url::Url::parse(BLUESKY_APPVIEW)?.join("/xrpc/app.bsky.actor.getProfile")?;
        url.query_pairs_mut().append_pair("actor", did);
        let response = self.http.get(url).send().await?;
        if response.status() == reqwest::StatusCode::BAD_REQUEST {
            return Ok(None);
        }
        let profile = read_json(response.error_for_status()?).await?;
        Ok(Some(ActorIdentity {
            handle: string_field(&profile, "handle").filter(|h| h != "handle.invalid"),
            display_name: string_field(&profile, "displayName"),
            avatar: string_field(&profile, "avatar"),
        }))
    }

    /// Whether `handle` resolves back to `did`, so a DID document can't borrow
    /// someone else's name.
    async fn handle_resolves_to(&self, handle: &str, did: &str) -> bool {
        let Ok(mut url) =
            url::Url::parse(BLUESKY_APPVIEW).and_then(|u| u.join("/xrpc/com.atproto.identity.resolveHandle"))
        else {
            return false;
        };
        url.query_pairs_mut().append_pair("handle", handle);
        let Ok(response) = self.http.get(url).send().await else {
            return false;
        };
        let Ok(body) = response.json::<Value>().await else {
            return false;
        };
        body.get("did").and_then(Value::as_str) == Some(did)
    }
}

/// A DID document, record, or profile is a few kilobytes; anything near this is hostile.
const MAX_JSON_BYTES: usize = 256 * 1024;

async fn read_json(mut response: reqwest::Response) -> anyhow::Result<Value> {
    anyhow::ensure!(
        response.content_length().is_none_or(|length| length <= MAX_JSON_BYTES as u64),
        "response too large"
    );
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        anyhow::ensure!(body.len() + chunk.len() <= MAX_JSON_BYTES, "response too large");
        body.extend_from_slice(&chunk);
    }
    Ok(serde_json::from_slice(&body)?)
}

fn http_client(pinned: Option<(&str, &[SocketAddr])>) -> anyhow::Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(HTTP_TIMEOUT)
        .user_agent("teal-aqua (+https://teal.fm)");
    if let Some((host, addrs)) = pinned {
        builder = builder.resolve_to_addrs(host, addrs);
    }
    Ok(builder.build()?)
}

/// A client that can only reach `host` at the public addresses it resolves to now,
/// so neither a private address nor a later DNS answer can redirect the request.
async fn public_client(host: &str) -> anyhow::Result<reqwest::Client> {
    anyhow::ensure!(
        !host.eq_ignore_ascii_case("localhost") && !host.ends_with(".localhost"),
        "{host} is not a public host"
    );
    let addrs: Vec<SocketAddr> = tokio::net::lookup_host((host, 443)).await?.collect();
    anyhow::ensure!(!addrs.is_empty(), "{host} did not resolve");
    anyhow::ensure!(
        addrs.iter().all(|addr| is_public_ip(addr.ip())),
        "{host} resolves to a private address"
    );
    http_client(Some((host, &addrs)))
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, ..] = ip.octets();
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_multicast()
                || ip.is_broadcast()
                || ip.is_documentation()
                // Shared address space (CGNAT, Tailscale) and benchmarking ranges.
                || (a == 100 && (64..128).contains(&b))
                || (a == 198 && (18..20).contains(&b))
                || a == 0
                || a >= 240)
        }
        IpAddr::V6(ip) => match ip.to_ipv4_mapped() {
            Some(v4) => is_public_ip(IpAddr::V4(v4)),
            None => {
                !(ip.is_loopback()
                    || ip.is_unspecified()
                    || ip.is_multicast()
                    || ip.is_unique_local()
                    || ip.is_unicast_link_local())
            }
        },
    }
}

fn ttl(lookup: &Lookup) -> Duration {
    match lookup {
        Lookup::Found(_) => FOUND_TTL,
        Lookup::Missing => MISSING_TTL,
        Lookup::Failed => FAILED_TTL,
    }
}

fn is_did(value: &str) -> bool {
    value.starts_with("did:plc:") || value.starts_with("did:web:")
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// The CID of a blob ref, in either the current or the legacy JSON shape.
fn blob_cid(blob: Option<&Value>) -> Option<String> {
    let blob = blob?;
    blob.pointer("/ref/$link")
        .or_else(|| blob.get("cid"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn document_handle(doc: &Value) -> Option<String> {
    doc.get("alsoKnownAs")?
        .as_array()?
        .iter()
        .filter_map(Value::as_str)
        .find_map(|aka| aka.strip_prefix("at://"))
        .map(str::to_string)
}

fn pds_endpoint(doc: &Value) -> Option<String> {
    doc.get("service")?.as_array()?.iter().find_map(|service| {
        let id = service.get("id")?.as_str()?;
        (id == "#atproto_pds" || id.ends_with("#atproto_pds"))
            .then(|| service.get("serviceEndpoint")?.as_str().map(str::to_string))
            .flatten()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_handle_and_pds_from_a_did_document() {
        let doc = json!({
            "alsoKnownAs": ["at://karitham.dev"],
            "service": [{
                "id": "#atproto_pds",
                "type": "AtprotoPersonalDataServer",
                "serviceEndpoint": "https://pds.example.com"
            }]
        });
        assert_eq!(document_handle(&doc).as_deref(), Some("karitham.dev"));
        assert_eq!(pds_endpoint(&doc).as_deref(), Some("https://pds.example.com"));
    }

    #[test]
    fn reads_blob_cids_in_both_shapes() {
        let current = json!({"$type": "blob", "ref": {"$link": "bafkreiavatar"}, "mimeType": "image/jpeg", "size": 1});
        let legacy = json!({"cid": "bafkreilegacy", "mimeType": "image/jpeg"});
        assert_eq!(blob_cid(Some(&current)).as_deref(), Some("bafkreiavatar"));
        assert_eq!(blob_cid(Some(&legacy)).as_deref(), Some("bafkreilegacy"));
        assert_eq!(blob_cid(None), None);
    }

    #[test]
    fn private_and_shared_addresses_are_not_public() {
        for ip in [
            "127.0.0.1",
            "10.1.2.3",
            "192.168.1.1",
            "172.16.0.1",
            "169.254.169.254",
            "100.100.1.1",
            "0.0.0.0",
            "::1",
            "fd00::1",
            "fe80::1",
            "::ffff:127.0.0.1",
        ] {
            assert!(!is_public_ip(ip.parse().unwrap()), "{ip} should not be public");
        }
        for ip in ["1.1.1.1", "2606:4700:4700::1111"] {
            assert!(is_public_ip(ip.parse().unwrap()), "{ip} should be public");
        }
    }

    #[test]
    fn only_plc_and_web_dids_are_looked_up() {
        assert!(is_did("did:plc:kcgwlowulc3rac43lregdawo"));
        assert!(is_did("did:web:example.com"));
        assert!(!is_did("alice.bsky.social"));
        assert!(!is_did("did:key:z6Mk"));
    }

    #[test]
    fn blank_strings_are_treated_as_missing() {
        let profile = json!({"displayName": "  ", "handle": "alice.test"});
        assert_eq!(string_field(&profile, "displayName"), None);
        assert_eq!(string_field(&profile, "handle").as_deref(), Some("alice.test"));
    }
}
