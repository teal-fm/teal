/**
 * Last.fm API functions for the evaluation harness.
 * All functions take apiKey/apiSecret as parameters (no module-level globals).
 */

import type { LastFMTrack, LastFMResponse, APIMetrics } from "./types.js";
import type { LastFMCache } from "./evaluate-lastfm-cache.js";
import { generateSignature } from "./auth.js";

/**
 * Get user's recent tracks from Last.fm.
 * Handles pagination, retries, and rate limiting.
 */
export async function getRecentTracks(
  apiKey: string,
  apiSecret: string,
  username: string,
  limit: number,
  sessionKey?: string,
  page: number = 1,
): Promise<LastFMTrack[]> {
  const params: Record<string, string> = {
    method: "user.getRecentTracks",
    api_key: apiKey,
    limit: Math.min(limit, 200).toString(),
    page: page.toString(),
    format: "json",
  };

  if (username) params.user = username;

  if (sessionKey) {
    params.sk = sessionKey;
    const sig = await generateSignature(params, apiSecret);
    params.api_sig = sig;
  }

  const queryString = new URLSearchParams(params).toString();
  const url = `https://ws.audioscrobbler.com/2.0/?${queryString}`;

  let retries = 3;
  let delay = 1000;
  while (retries > 0) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data: LastFMResponse = await res.json();
        if (data.recenttracks?.track) {
          const tracks = data.recenttracks.track;
          return Array.isArray(tracks) ? tracks : [tracks];
        }
        return [];
      }

      if (res.status >= 500 && retries > 1) {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      const errorText = await res.text();
      throw new Error(`Last.fm API error: ${res.statusText} - ${errorText}`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "";
      if (
        retries > 1 &&
        (errorMsg.includes("500") ||
          errorMsg.includes("503") ||
          errorMsg.includes("Internal Server Error"))
      ) {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }

  return [];
}

/**
 * Get track correction from Last.fm (canonical name).
 */
export async function getTrackCorrection(
  track: string,
  artist: string,
  apiKey: string,
  apiSecret: string,
  sessionKey: string,
  cache?: LastFMCache,
  apiMetrics?: APIMetrics,
): Promise<{ track: string; artist: string } | null> {
  if (cache) {
    const cached = cache.getTrackCorrection(track, artist);
    if (cached !== undefined) {
      return cached
        ? { track: cached.correctedTrack, artist: cached.correctedArtist }
        : null;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 200));

  const params: Record<string, string> = {
    method: "track.getCorrection",
    track,
    artist,
    api_key: apiKey,
    sk: sessionKey,
    format: "json",
  };

  const sig = await generateSignature(params, apiSecret);
  params.api_sig = sig;

  const queryString = new URLSearchParams(params).toString();
  const url = `https://ws.audioscrobbler.com/2.0/?${queryString}`;

  let retries = 3;
  let delay = 200;
  while (retries > 0) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.corrections?.correction?.track) {
          const corrected = data.corrections.correction.track;
          const correctedTrack = corrected.name || track;
          const correctedArtist = corrected.artist?.name || artist;
          if (cache)
            cache.setTrackCorrection(
              track,
              artist,
              correctedTrack,
              correctedArtist,
            );
          return { track: correctedTrack, artist: correctedArtist };
        }
        break;
      }

      if (res.status >= 500 && retries > 1) {
        if (apiMetrics) apiMetrics.lastfmErrors++;
        retries--;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      if (apiMetrics && res.status >= 400) apiMetrics.lastfmErrors++;
      break;
    } catch (e) {
      if (apiMetrics) apiMetrics.lastfmErrors++;
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      break;
    }
  }

  if (cache) cache.setTrackCorrection(track, artist, null, null);
  return null;
}

/**
 * Search for tracks on Last.fm.
 */
export async function searchTracksOnLastFM(
  track: string,
  artist: string,
  apiKey: string,
  apiSecret: string,
  sessionKey: string,
  limit: number = 10,
  cache?: LastFMCache,
  apiMetrics?: APIMetrics,
): Promise<Array<{ track: string; artist: string; mbid: string | null }>> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const params: Record<string, string> = {
    method: "track.search",
    track: `${track} ${artist}`,
    api_key: apiKey,
    limit: limit.toString(),
    format: "json",
  };

  if (sessionKey) {
    params.sk = sessionKey;
    const sig = await generateSignature(params, apiSecret);
    params.api_sig = sig;
  }

  const queryString = new URLSearchParams(params).toString();
  const url = `https://ws.audioscrobbler.com/2.0/?${queryString}`;

  let retries = 3;
  let delay = 200;
  while (retries > 0) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.results?.trackmatches?.track) {
          const tracks = Array.isArray(data.results.trackmatches.track)
            ? data.results.trackmatches.track
            : [data.results.trackmatches.track];
          return tracks.map((t: any) => ({
            track: t.name,
            artist: t.artist,
            mbid: t.mbid || null,
          }));
        }
        return [];
      }

      if (res.status >= 500 && retries > 1) {
        if (apiMetrics) apiMetrics.lastfmErrors++;
        retries--;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      if (apiMetrics && res.status >= 400) apiMetrics.lastfmErrors++;
      return [];
    } catch (e) {
      if (apiMetrics) apiMetrics.lastfmErrors++;
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      return [];
    }
  }

  return [];
}

/**
 * Get artist info from Last.fm (including MBID and aliases).
 */
export async function getArtistInfo(
  artist: string,
  apiKey: string,
  apiSecret: string,
  sessionKey: string,
  cache?: LastFMCache,
  apiMetrics?: APIMetrics,
): Promise<{ mbid: string | null; aliases: string[] } | null> {
  if (cache) {
    const cached = cache.getArtistInfo(artist);
    if (cached !== undefined) return cached;
  }

  await new Promise((resolve) => setTimeout(resolve, 200));

  const params: Record<string, string> = {
    method: "artist.getInfo",
    artist,
    api_key: apiKey,
    sk: sessionKey,
    format: "json",
  };

  const sig = await generateSignature(params, apiSecret);
  params.api_sig = sig;

  const queryString = new URLSearchParams(params).toString();
  const url = `https://ws.audioscrobbler.com/2.0/?${queryString}`;

  let retries = 3;
  let delay = 200;
  while (retries > 0) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.artist) {
          const mbid = data.artist.mbid || null;
          const aliases = data.artist.alias
            ? (Array.isArray(data.artist.alias)
                ? data.artist.alias
                : [data.artist.alias]
              ).map((a: any) =>
                typeof a === "string" ? a : a["#text"] || a,
              )
            : [];

          const result = { mbid, aliases };
          if (cache) cache.setArtistInfo(artist, result);
          return result;
        }
        break;
      }

      if (res.status >= 500 && retries > 1) {
        if (apiMetrics) apiMetrics.lastfmErrors++;
        retries--;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      if (apiMetrics && res.status >= 400) apiMetrics.lastfmErrors++;
      break;
    } catch (e) {
      if (apiMetrics) apiMetrics.lastfmErrors++;
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      break;
    }
  }

  if (cache) cache.setArtistInfo(artist, null);
  return null;
}

/**
 * Get album info from Last.fm (including MBID).
 */
export async function getAlbumInfo(
  artist: string,
  album: string,
  apiKey: string,
  apiSecret: string,
  sessionKey: string,
  cache?: LastFMCache,
  apiMetrics?: APIMetrics,
): Promise<{ mbid: string | null } | null> {
  if (cache) {
    const cached = cache.getAlbumInfo(artist, album);
    if (cached !== undefined) return cached;
  }

  await new Promise((resolve) => setTimeout(resolve, 200));

  const params: Record<string, string> = {
    method: "album.getInfo",
    artist,
    album,
    api_key: apiKey,
    sk: sessionKey,
    format: "json",
  };

  const sig = await generateSignature(params, apiSecret);
  params.api_sig = sig;

  const queryString = new URLSearchParams(params).toString();
  const url = `https://ws.audioscrobbler.com/2.0/?${queryString}`;

  let retries = 3;
  let delay = 200;
  while (retries > 0) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.album) {
          const result = { mbid: data.album.mbid || null };
          if (cache) cache.setAlbumInfo(artist, album, result);
          return result;
        }
        break;
      }

      if (res.status >= 500 && retries > 1) {
        if (apiMetrics) apiMetrics.lastfmErrors++;
        retries--;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      if (apiMetrics && res.status >= 400) apiMetrics.lastfmErrors++;
      break;
    } catch (e) {
      if (apiMetrics) apiMetrics.lastfmErrors++;
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      break;
    }
  }

  if (cache) cache.setAlbumInfo(artist, album, null);
  return null;
}
