/**
 * MBID resolution functions for the evaluation harness.
 *
 * Key design: every function that returns an MBID also returns its *source*
 * (MBIDSource), so callers can decide whether it is safe to use as ground
 * truth. Only "lastfm_track_info", "lastfm_search", and "track_data" are
 * independent of MusicBrainz search; "musicbrainz_search" is circular.
 */

import {
  MUSICBRAINZ_BASE_URL,
  USER_AGENT,
  RATE_LIMIT_DELAY,
  type APIMetrics,
  type MBIDResult,
  type MBIDSource,
} from "./types.js";
import {
  cleanTrackName,
  cleanArtistName,
} from "../../apps/amethyst/lib/musicbrainzCleaner.js";
import { escapeLucene } from "../../apps/amethyst/lib/musicbrainzSearchUtils.js";
import type { LastFMCache } from "./evaluate-lastfm-cache.js";
import { generateSignature } from "./auth.js";
import {
  getTrackCorrection,
  searchTracksOnLastFM,
} from "./lastfm-api.js";

// ── MusicBrainz search (source: "musicbrainz_search") ─────────────────

/**
 * Search MusicBrainz for a recording MBID using multiple strategies.
 * Previously named getMBIDViaISRC (misleading -- no ISRC logic).
 *
 * WARNING: Results from this function are search-derived and MUST NOT
 * be used as ground truth for evaluating search quality (circular).
 */
async function searchMusicBrainzForMBID(
  track: string,
  artist: string,
): Promise<string | null> {
  const cleanedTrack = cleanTrackName(track);
  const cleanedArtist = cleanArtistName(artist);

  // Strategy 1: Exact match with cleaned names
  if (cleanedTrack && cleanedArtist) {
    const q = `recording:"${escapeLucene(cleanedTrack)}" AND artist:"${escapeLucene(cleanedArtist)}"`;
    const mbid = await tryMusicBrainzSearch(q, cleanedTrack, cleanedArtist);
    if (mbid) return mbid;
  }

  // Strategy 2: Exact match with original names
  const q2 = `recording:"${escapeLucene(track)}" AND artist:"${escapeLucene(artist)}"`;
  let mbid = await tryMusicBrainzSearch(q2, track, artist);
  if (mbid) return mbid;

  // Strategy 3: Fuzzy match
  const searchTrack = cleanedTrack || track;
  const searchArtist = cleanedArtist || artist;
  const trackWords = searchTrack.split(" ");
  const artistWords = searchArtist.split(" ");

  if (trackWords.length > 1) {
    const fuzzyTrackQuery = `recording:"${escapeLucene(searchTrack)}"~3`;
    const fuzzyArtistQuery =
      artistWords.length > 1
        ? `artist:"${escapeLucene(searchArtist)}"~3`
        : `artist:${escapeLucene(searchArtist)}~`;
    mbid = await tryMusicBrainzSearch(
      `${fuzzyTrackQuery} AND ${fuzzyArtistQuery}`,
      searchTrack,
      searchArtist,
    );
  } else {
    mbid = await tryMusicBrainzSearch(
      `recording:${escapeLucene(searchTrack)}~ AND artist:${escapeLucene(searchArtist)}~`,
      searchTrack,
      searchArtist,
    );
  }
  if (mbid) return mbid;

  // Strategy 4: Partial match (word-by-word)
  mbid = await tryMusicBrainzSearch(
    `recording:${escapeLucene(searchTrack)} AND artist:${escapeLucene(searchArtist)}`,
    searchTrack,
    searchArtist,
  );
  if (mbid) return mbid;

  // Strategy 5: Artist-only search
  mbid = await tryMusicBrainzSearch(
    `artist:"${escapeLucene(searchArtist)}"`,
    searchTrack,
    searchArtist,
    true,
  );
  return mbid;
}

/** Helper: try a single MusicBrainz search query. */
async function tryMusicBrainzSearch(
  query: string,
  originalTrack: string,
  originalArtist: string,
  checkISRC: boolean = false,
): Promise<string | null> {
  try {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    const url = `${MUSICBRAINZ_BASE_URL}/recording?query=${encodeURIComponent(query)}&limit=10&fmt=json`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });

    if (res.ok) {
      const data = await res.json();
      if (data.recordings?.length > 0) {
        for (const recording of data.recordings) {
          if (checkISRC) {
            const recUrl = `${MUSICBRAINZ_BASE_URL}/recording/${recording.id}?inc=isrcs&fmt=json`;
            await new Promise((resolve) =>
              setTimeout(resolve, RATE_LIMIT_DELAY),
            );
            const recRes = await fetch(recUrl, {
              headers: { "User-Agent": USER_AGENT },
            });
            if (recRes.ok) {
              const recData = await recRes.json();
              if (recData.isrcs?.length > 0) return recording.id;
            }
          }
          if (!checkISRC) return recording.id;
        }
        return data.recordings[0].id;
      }
    }
  } catch {
    // Ignore errors, try next strategy
  }
  return null;
}

// ── MBID validation ────────────────────────────────────────────────────

/**
 * Validate that an MBID exists in MusicBrainz.
 * Retries on 503 with exponential backoff.
 */
export async function validateMBID(
  mbid: string,
  cache?: LastFMCache,
  apiMetrics?: APIMetrics,
): Promise<boolean> {
  if (cache) {
    const cached = cache.getMBIDValidationDetailed(mbid);
    if (cached !== undefined) {
      if (cached.httpStatus === 200 || cached.httpStatus === 301 || cached.httpStatus === 404) {
        return cached.isValid;
      }
    }
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const delay =
        RATE_LIMIT_DELAY * (attempt === 0 ? 1 : Math.pow(2, attempt));
      await new Promise((resolve) => setTimeout(resolve, delay));

      const lookupUrl = `${MUSICBRAINZ_BASE_URL}/recording/${mbid}?fmt=json`;
      const apiCallStart = Date.now();
      // Use redirect: "manual" to detect 301 (merged recordings)
      const res = await fetch(lookupUrl, {
        headers: { "User-Agent": USER_AGENT },
        redirect: "manual",
      });
      const apiCallTime = Date.now() - apiCallStart;

      if (apiMetrics) {
        apiMetrics.musicbrainzCalls++;
        apiMetrics.totalAPICallTime += apiCallTime;
      }

      if (res.status === 404) {
        if (cache) cache.setMBIDValidation(mbid, false, 404, "404 Not Found");
        return false;
      }

      if (res.status === 301) {
        // Merged recording -- follow redirect to get canonical MBID
        // MB redirects: /ws/2/recording/<old>?fmt=json -> /ws/2/recording/<new>?fmt=json
        const location = res.headers.get("location");
        let canonicalMbid: string | undefined;
        if (location) {
          const match = location.match(/\/recording\/([0-9a-f-]{36})/);
          if (match) canonicalMbid = match[1];
        }
        if (!canonicalMbid) {
          // Fallback: follow the redirect to read the response body
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
          const followRes = await fetch(lookupUrl, {
            headers: { "User-Agent": USER_AGENT },
            redirect: "follow",
          });
          if (apiMetrics) apiMetrics.musicbrainzCalls++;
          if (followRes.ok) {
            const data = await followRes.json();
            canonicalMbid = data.id;
          }
        }
        if (cache) cache.setMBIDValidation(mbid, true, 301, `merged -> ${canonicalMbid || "unknown"}`, canonicalMbid);
        return true;
      }

      if (res.ok) {
        if (cache) cache.setMBIDValidation(mbid, true, 200);
        return true;
      }
      if (res.status === 503) {
        if (apiMetrics) apiMetrics.musicbrainzRateLimits++;
        if (attempt < MAX_RETRIES - 1) continue;
        return true; // conservative fallback, uncached
      }

      if (apiMetrics) apiMetrics.musicbrainzErrors++;
      if (attempt < MAX_RETRIES - 1) continue;
      return true;
    } catch {
      if (apiMetrics) apiMetrics.musicbrainzErrors++;
      if (attempt < MAX_RETRIES - 1) continue;
      return true;
    }
  }
  return true;
}

// ── Work-equivalence ───────────────────────────────────────────────────

/**
 * Fetch the work ID linked to a MusicBrainz recording.
 */
export async function getRecordingWorkId(
  recordingMbid: string,
  cache?: LastFMCache,
  apiMetrics?: APIMetrics,
): Promise<string | null> {
  if (cache) {
    const cached = cache.getRecordingWork(recordingMbid);
    if (cached !== undefined) return cached.workId;
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    const url = `${MUSICBRAINZ_BASE_URL}/recording/${recordingMbid}?inc=work-rels&fmt=json`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (apiMetrics) apiMetrics.musicbrainzCalls++;

    if (!res.ok) {
      if (res.status === 503 && apiMetrics)
        apiMetrics.musicbrainzRateLimits++;
      return null;
    }

    const data = (await res.json()) as any;
    const workRel = data.relations?.find(
      (r: any) => r.type === "performance" && r.work,
    );
    const workId = workRel?.work?.id ?? null;
    const workTitle = workRel?.work?.title ?? null;

    if (cache) cache.setRecordingWork(recordingMbid, workId, workTitle);
    return workId;
  } catch {
    return null;
  }
}

/**
 * Check if two recordings are work-equivalent (same underlying composition).
 */
export async function areRecordingsWorkEquivalent(
  mbidA: string,
  mbidB: string,
  cache?: LastFMCache,
  apiMetrics?: APIMetrics,
): Promise<boolean> {
  const workA = await getRecordingWorkId(mbidA, cache, apiMetrics);
  if (!workA) return false;
  const workB = await getRecordingWorkId(mbidB, cache, apiMetrics);
  if (!workB) return false;
  return workA === workB;
}

// ── Main MBID resolution ──────────────────────────────────────────────

/**
 * Get track MBID from Last.fm, with source provenance tracking.
 *
 * Returns {mbid, source} where source indicates how the MBID was obtained.
 * Only MBIDs with source !== "musicbrainz_search" are safe as ground truth.
 *
 * Methods tried in order:
 * 0. track.getCorrection (canonical name)
 * 1. track.getInfo (Last.fm authenticated) -> source: "lastfm_track_info"
 * 2. track.search (Last.fm search) -> source: "lastfm_search"
 * 3. MusicBrainz recording search (if useAdditionalAPIs) -> source: "musicbrainz_search"
 */
export async function getTrackMBID(
  track: string,
  artist: string,
  apiKey: string,
  apiSecret: string,
  sessionKey: string,
  cache?: LastFMCache,
  useAdditionalAPIs: boolean = false,
  apiMetrics?: APIMetrics,
): Promise<MBIDResult> {
  // Check cache first
  if (cache) {
    const cached = cache.getMBIDWithSource(track, artist);
    if (cached !== undefined) {
      return { mbid: cached.mbid, source: cached.source };
    }
  }

  // Method 0: Try track.getCorrection first (get canonical name)
  const correction = await getTrackCorrection(
    track,
    artist,
    apiKey,
    apiSecret,
    sessionKey,
    cache,
    apiMetrics,
  );
  let searchTrack = track;
  let searchArtist = artist;
  if (correction) {
    searchTrack = correction.track;
    searchArtist = correction.artist;
    if (apiMetrics) apiMetrics.lastfmCalls++;
  }

  // Method 1: Try track.getInfo (Last.fm authenticated)
  if (apiMetrics) apiMetrics.lastfmCalls++;
  const params: Record<string, string> = {
    method: "track.getInfo",
    track: searchTrack,
    artist: searchArtist,
    api_key: apiKey,
    sk: sessionKey,
    format: "json",
  };

  const sig = await generateSignature(params, apiSecret);
  params.api_sig = sig;

  const queryString = new URLSearchParams(params).toString();
  const url = `https://ws.audioscrobbler.com/2.0/?${queryString}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.track?.mbid) {
        const mbid = data.track.mbid;
        if (useAdditionalAPIs) {
          const isValid = await validateMBID(mbid, cache, apiMetrics);
          if (isValid) {
            if (cache) {
              cache.setMBIDWithSource(track, artist, mbid, "lastfm_track_info");
              if (correction)
                cache.setMBIDWithSource(
                  searchTrack,
                  searchArtist,
                  mbid,
                  "lastfm_track_info",
                );
            }
            return { mbid, source: "lastfm_track_info" };
          }
        } else {
          if (cache) {
            cache.setMBIDWithSource(track, artist, mbid, "lastfm_track_info");
            if (correction)
              cache.setMBIDWithSource(
                searchTrack,
                searchArtist,
                mbid,
                "lastfm_track_info",
              );
          }
          return { mbid, source: "lastfm_track_info" };
        }
      }

      // Try corrected name from response
      if (data.track?.name && data.track.name !== searchTrack) {
        const correctedParams: Record<string, string> = {
          method: "track.getInfo",
          track: data.track.name,
          artist: data.track.artist?.name || searchArtist,
          api_key: apiKey,
          sk: sessionKey,
          format: "json",
        };
        const correctedSig = await generateSignature(correctedParams, apiSecret);
        correctedParams.api_sig = correctedSig;
        const correctedUrl = `https://ws.audioscrobbler.com/2.0/?${new URLSearchParams(correctedParams).toString()}`;
        const correctedRes = await fetch(correctedUrl);
        if (correctedRes.ok) {
          const correctedData = await correctedRes.json();
          if (correctedData.track?.mbid) {
            const mbid = correctedData.track.mbid;
            if (useAdditionalAPIs) {
              const isValid = await validateMBID(mbid, cache, apiMetrics);
              if (isValid) {
                if (cache)
                  cache.setMBIDWithSource(
                    track,
                    artist,
                    mbid,
                    "lastfm_track_info",
                  );
                return { mbid, source: "lastfm_track_info" };
              }
            } else {
              if (cache)
                cache.setMBIDWithSource(
                  track,
                  artist,
                  mbid,
                  "lastfm_track_info",
                );
              return { mbid, source: "lastfm_track_info" };
            }
          }
        }
      }
    }
  } catch {
    // fall through
  }

  // Method 2: Try track.search (Last.fm search)
  if (apiMetrics) apiMetrics.lastfmCalls++;
  const searchResults = await searchTracksOnLastFM(
    searchTrack,
    searchArtist,
    apiKey,
    apiSecret,
    sessionKey,
    10,
    cache,
    apiMetrics,
  );
  for (const result of searchResults) {
    const trackMatch =
      result.track.toLowerCase() === searchTrack.toLowerCase() ||
      result.track.toLowerCase().includes(searchTrack.toLowerCase()) ||
      searchTrack.toLowerCase().includes(result.track.toLowerCase());
    const artistMatch =
      result.artist.toLowerCase() === searchArtist.toLowerCase() ||
      result.artist.toLowerCase().includes(searchArtist.toLowerCase()) ||
      searchArtist.toLowerCase().includes(result.artist.toLowerCase());

    if (trackMatch && artistMatch && result.mbid) {
      if (useAdditionalAPIs && apiMetrics) {
        const isValid = await validateMBID(result.mbid, cache, apiMetrics);
        if (isValid) {
          if (cache)
            cache.setMBIDWithSource(
              track,
              artist,
              result.mbid,
              "lastfm_search",
            );
          return { mbid: result.mbid, source: "lastfm_search" };
        }
      } else {
        if (cache)
          cache.setMBIDWithSource(
            track,
            artist,
            result.mbid,
            "lastfm_search",
          );
        return { mbid: result.mbid, source: "lastfm_search" };
      }
    }
  }

  // Method 3: MusicBrainz search (CIRCULAR -- marked as such)
  if (useAdditionalAPIs) {
    const mbidViaMB = await searchMusicBrainzForMBID(track, artist);
    if (mbidViaMB) {
      const isValid = await validateMBID(mbidViaMB, cache, apiMetrics);
      if (isValid) {
        if (cache)
          cache.setMBIDWithSource(
            track,
            artist,
            mbidViaMB,
            "musicbrainz_search",
          );
        return { mbid: mbidViaMB, source: "musicbrainz_search" };
      }
    }
  }

  // No MBID found
  if (cache) cache.setMBIDWithSource(track, artist, null, null);
  return { mbid: null, source: null };
}
