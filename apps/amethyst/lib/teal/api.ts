import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";
import type { ProfileView } from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import type { ArtistView, ReleaseView } from "@teal/lexicons/src/types/fm/teal/alpha/stats/defs";

const rawBase =
  process.env.EXPO_PUBLIC_AQUA_URL ||
  process.env.EXPO_PUBLIC_APPVIEW_URL ||
  "";

const requestBase =
  rawBase || (typeof window === "undefined" ? "http://localhost:3000" : window.location.origin);
const xrpcBase = requestBase.endsWith("/xrpc")
  ? requestBase
  : `${requestBase.replace(/\/$/, "")}/xrpc`;

async function getXrpc<T>(
  method: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${xrpcBase}/${method}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`${method} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getLatestPlays(limit = 50) {
  return getXrpc<{ plays: PlayView[] }>("fm.teal.alpha.stats.getLatest", {
    limit,
  });
}

export function getActorFeed(authorDID: string, limit = 50) {
  return getXrpc<{ plays: PlayView[] }>("fm.teal.alpha.feed.getActorFeed", {
    authorDID,
    limit,
  });
}

export function getPlayByUri(uri: string) {
  return getXrpc<{ play: PlayView }>("fm.teal.alpha.feed.getPlay", { uri });
}

export function getProfile(actor: string) {
  return getXrpc<{ profile: ProfileView }>("fm.teal.alpha.actor.getProfile", {
    actor,
  });
}

export function getTopArtists(limit = 5) {
  return getXrpc<{ artists: ArtistView[] }>("fm.teal.alpha.stats.getTopArtists", {
    limit,
  });
}

export function getTopReleases(limit = 5) {
  return getXrpc<{ releases: ReleaseView[] }>(
    "fm.teal.alpha.stats.getTopReleases",
    { limit },
  );
}

export function coverArtUrl(releaseMbId?: string, size = 250) {
  const mbid = releaseMbId?.replace(/^mbid:/, "");
  return mbid ? `https://coverartarchive.org/release/${mbid}/front-${size}` : undefined;
}

export function displayArtists(play: PlayView) {
  return play.artists.map((artist) => artist.artistName).join(", ");
}
