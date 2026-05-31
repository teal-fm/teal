import type { AppBskyActorDefs } from "@atproto/api";

import type {
  MiniProfileView,
  ProfileView,
} from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";
import type { SongResult } from "@teal/lexicons/src/types/fm/teal/alpha/search/defs";
import type {
  ArtistView,
  ReleaseView,
} from "@teal/lexicons/src/types/fm/teal/alpha/stats/defs";

const rawBase =
  process.env.EXPO_PUBLIC_AQUA_URL || process.env.EXPO_PUBLIC_APPVIEW_URL || "";

const requestBase =
  rawBase ||
  (typeof window === "undefined"
    ? "http://localhost:3000"
    : window.location.origin);
const xrpcBase = requestBase.endsWith("/xrpc")
  ? requestBase
  : `${requestBase.replace(/\/$/, "")}/xrpc`;

export class XrpcError extends Error {
  constructor(
    method: string,
    public readonly status: number,
  ) {
    super(`${method} failed with ${status}`);
  }
}

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
    throw new XrpcError(method, response.status);
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

export async function getBlueskyProfile(actor: string) {
  const url = new URL(
    "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile",
  );
  url.searchParams.set("actor", actor);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new XrpcError("app.bsky.actor.getProfile", response.status);
  }

  return response.json() as Promise<AppBskyActorDefs.ProfileViewDetailed>;
}

export function getTopArtists(limit = 5) {
  return getXrpc<{ artists: ArtistView[] }>(
    "fm.teal.alpha.stats.getTopArtists",
    {
      limit,
    },
  );
}

export function getTopReleases(limit = 5) {
  return getXrpc<{ releases: ReleaseView[] }>(
    "fm.teal.alpha.stats.getTopReleases",
    { limit },
  );
}

export type SearchResults = {
  users: MiniProfileView[];
  songs: SongResult[];
  artists: ArtistView[];
  albums: ReleaseView[];
};

export function getSearchResults(q: string, limit = 8) {
  return getXrpc<SearchResults>("fm.teal.alpha.search.getResults", {
    q,
    limit,
  });
}

export async function searchBlueskyUsers(q: string, limit = 8) {
  const url = new URL(
    "https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors",
  );
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new XrpcError("app.bsky.actor.searchActors", response.status);
  }

  return response.json() as Promise<{
    actors: AppBskyActorDefs.ProfileViewBasic[];
  }>;
}

export function coverArtUrl(releaseMbId?: string, size = 250) {
  const mbid = releaseMbId?.replace(/^mbid:/, "");
  return mbid
    ? `https://coverartarchive.org/release/${mbid}/front-${size}`
    : undefined;
}

export function displayArtists(play: PlayView) {
  return play.artists.map((artist) => artist.artistName).join(", ");
}
