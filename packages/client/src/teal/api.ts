import type { AppBskyActorDefs } from "@atproto/api";

import type {
  MiniProfileView,
  ProfileView,
} from "@teal/lexicons/src/fm/teal/actor/defs";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type {
  AlbumView,
  ArtistListenerView,
  ArtistView as MusicArtistView,
} from "@teal/lexicons/src/fm/teal/music/defs";
import type { SongResult } from "@teal/lexicons/src/fm/teal/search/defs";
import type {
  ArtistView,
  RecordingView,
  ReleaseView,
} from "@teal/lexicons/src/fm/teal/stats/defs";

import { clientConfig } from "../config";

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;

/**
 * Where XRPC requests go. A browser that reached the dev server through another
 * host (Tailscale, a LAN IP) can't use a loopback base baked into the bundle, so
 * it falls back to its own origin, which proxies /xrpc the same way.
 */
export function resolveRequestBase(
  configured: string,
  pageOrigin: string | undefined,
) {
  if (!pageOrigin) return configured || "http://localhost:3000";
  if (!configured) return pageOrigin;
  try {
    const page = new URL(pageOrigin).hostname;
    if (LOOPBACK.test(new URL(configured).hostname) && !LOOPBACK.test(page)) {
      return pageOrigin;
    }
  } catch {
    // An unparseable base is left for fetch to report.
  }
  return configured;
}

function xrpcBase() {
  const requestBase = resolveRequestBase(
    clientConfig().aquaUrl,
    typeof window === "undefined" ? undefined : window.location?.origin,
  );
  return requestBase.endsWith("/xrpc")
    ? requestBase
    : `${requestBase.replace(/\/$/, "")}/xrpc`;
}

export class XrpcError extends Error {
  constructor(
    method: string,
    public readonly status: number,
  ) {
    super(`${method} failed with ${status}`);
  }
}

export type SocialNotificationView = {
  id: number;
  actorDid: string;
  actor?: MiniProfileView;
  reason: string;
  recordUri: string;
  subjectUri?: string;
  createdAt: string;
};

export type SocialPostView = {
  uri: string;
  cid: string;
  authorDid: string;
  author?: MiniProfileView;
  text: string;
  track: unknown;
  replyRootUri?: string;
  replyRootCid?: string;
  replyParentUri?: string;
  replyParentCid?: string;
  facets?: unknown[];
  langs?: string[];
  tags?: string[];
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  viewerLike?: string;
  viewerRepost?: string;
  reactions?: ReactionSummary[];
  listenContext?: ListenContext;
};

export type ReactionSummary = {
  emoji: string;
  count: number;
  viewerReaction?: string;
};

export type ListenContext = {
  circleListenerCount: number;
  circleSample: MiniProfileView[];
  authorPlayCount?: number;
  viewerPlayCount?: number;
};

export type ReleaseSummary = {
  releaseMbId?: string;
  releaseName: string;
  artistName?: string;
};

export type ListeningView = {
  actor?: MiniProfileView;
  playUri: string;
  playCid?: string;
  trackName: string;
  artistName?: string;
  recordingMbId?: string;
  releaseMbId?: string;
  releaseName?: string;
  playedTime: string;
  listeningNow: boolean;
  trackPlaysToday: number;
  releasePlaysToday: number;
  firstReleaseListen: boolean;
  reactions: ReactionSummary[];
};

export type MomentView = {
  kind: "mutuals" | "network" | "trending" | "circle";
  release: ReleaseSummary;
  listenerCount: number;
  listeners: MiniProfileView[];
  changePercent?: number;
};

export type TodayView = {
  listening: ListeningView[];
  moments: MomentView[];
  heatingUp: MomentView[];
};

export type TasteMatchView = {
  level: "high" | "some" | "low";
  sharedArtistCount: number;
  topArtistCount: number;
  sharedArtists: { name: string; releaseMbId?: string; releaseName?: string }[];
  suggestion?: ReleaseSummary & { rank: number };
};

export type ListeningDay = {
  date: string;
  playCount: number;
  topRelease?: ReleaseSummary;
  hours: { hour: number; playCount: number; releaseMbId?: string }[];
};

export type SocialPlaylistView = {
  uri: string;
  cid: string;
  authorDid: string;
  author?: MiniProfileView;
  name: string;
  description?: string;
  descriptionFacets?: unknown;
  authors: string[];
  coverCid?: string;
  createdAt: string;
  itemCount: number;
};

export type SocialPlaylistItemView = {
  uri: string;
  cid: string;
  authorDid: string;
  track: unknown;
  order?: number;
  createdAt: string;
};

export type GraphSummaryView = {
  followersCount: number;
  followsCount: number;
  viewerFollowing?: string;
};

export type ArtistListenerPeriod = "all" | "30days" | "7days";
export type StatsPeriod =
  "7days" | "30days" | "90days" | "180days" | "365days" | "all";

async function getXrpc<T>(
  method: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${xrpcBase()}/${method}`);
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

export function getToday(viewer?: string, limit = 12) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return getXrpc<TodayView>("fm.teal.feed.getToday", { viewer, tz, limit });
}

export function getReactions(subject: string, viewer?: string, emoji?: string) {
  return getXrpc<{
    summary: ReactionSummary[];
    reactions: {
      uri: string;
      emoji: string;
      actorDid: string;
      actor?: MiniProfileView;
      createdAt: string;
    }[];
    cursor?: string;
  }>("fm.teal.feed.social.getReactions", { subject, viewer, emoji });
}

export function getTasteMatch(actor: string, viewer: string) {
  return getXrpc<TasteMatchView>("fm.teal.actor.getTasteMatch", { actor, viewer });
}

export function getListeningCalendar(actor: string, from: string, to: string) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return getXrpc<{ days: ListeningDay[] }>("fm.teal.stats.getListeningCalendar", {
    actor,
    from,
    to,
    tz,
  });
}

export function getLatestPlays(limit = 50, cursor?: string) {
  return getXrpc<{ plays: PlayView[]; cursor?: string }>(
    "fm.teal.stats.getLatest",
    {
      limit,
      cursor,
    },
  );
}

export function getActorFeed(authorDID: string, limit = 30, cursor?: string) {
  return getXrpc<{ plays: PlayView[]; cursor?: string }>(
    "fm.teal.feed.getActorFeed",
    {
      authorDID,
      limit,
      cursor,
    },
  );
}

export function getPlayByUri(uri: string) {
  return getXrpc<{ play: PlayView }>("fm.teal.feed.getPlay", { uri });
}

export function getPlayByAuthorRkey(authorDID: string, rkey: string) {
  return getXrpc<{ play: PlayView }>("fm.teal.feed.getPlay", {
    authorDID,
    rkey,
  });
}

export function getArtist(mbid?: string, name?: string) {
  return getXrpc<{ artist: MusicArtistView }>("fm.teal.music.getArtist", {
    mbid,
    name,
  });
}

export function getArtistListeners(
  mbid?: string,
  name?: string,
  period: ArtistListenerPeriod = "all",
  limit = 50,
  cursor?: string,
) {
  return getXrpc<{ listeners: ArtistListenerView[]; cursor?: string }>(
    "fm.teal.music.getArtistListeners",
    {
      mbid,
      name,
      period,
      limit,
      cursor,
    },
  );
}

export function getAlbum(mbid: string, limit = 30, cursor?: string) {
  return getXrpc<{ album: AlbumView; plays: PlayView[]; cursor?: string }>(
    "fm.teal.music.getAlbum",
    { mbid, limit, cursor },
  );
}

export function getProfile(actor: string) {
  return getXrpc<{ profile: ProfileView }>("fm.teal.actor.getProfile", {
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
  return getXrpc<{ artists: ArtistView[] }>("fm.teal.stats.getTopArtists", {
    limit,
  });
}

export function getTopReleases(limit = 5) {
  return getXrpc<{ releases: ReleaseView[] }>("fm.teal.stats.getTopReleases", {
    limit,
  });
}

export function getUserTopArtists(
  actor: string,
  period: StatsPeriod = "90days",
  limit = 50,
  cursor?: string,
) {
  return getXrpc<{ artists: ArtistView[]; cursor?: string }>(
    "fm.teal.stats.getUserTopArtists",
    { actor, period, limit, cursor },
  );
}

export function getUserTopReleases(
  actor: string,
  period: StatsPeriod = "90days",
  limit = 50,
  cursor?: string,
) {
  return getXrpc<{ releases: ReleaseView[]; cursor?: string }>(
    "fm.teal.stats.getUserTopReleases",
    { actor, period, limit, cursor },
  );
}

export function getUserTopRecordings(
  actor: string,
  period: StatsPeriod = "90days",
  limit = 50,
  cursor?: string,
) {
  return getXrpc<{ recordings: RecordingView[]; cursor?: string }>(
    "fm.teal.stats.getUserTopRecordings",
    { actor, period, limit, cursor },
  );
}

export type SearchResults = {
  users: MiniProfileView[];
  songs: SongResult[];
  artists: ArtistView[];
  albums: ReleaseView[];
};

export function getSearchResults(q: string, limit = 8, actor?: string) {
  return getXrpc<SearchResults>("fm.teal.search.getResults", {
    q,
    limit,
    actor,
  });
}

export function getSocialFeed(
  limit = 30,
  cursor?: string,
  viewer?: string,
  actor?: string,
) {
  return getXrpc<{ items: SocialPostView[]; cursor?: string }>(
    "fm.teal.feed.social.getFeed",
    { limit, cursor, viewer, actor },
  );
}

export function getSocialPost(uri: string, viewer?: string) {
  return getXrpc<{ post: SocialPostView }>("fm.teal.feed.social.getPost", {
    uri,
    viewer,
  });
}

export function getSocialPostReplies(
  uri: string,
  limit = 30,
  cursor?: string,
  viewer?: string,
) {
  return getXrpc<{ items: SocialPostView[]; cursor?: string }>(
    "fm.teal.feed.social.getReplies",
    { uri, limit, cursor, viewer },
  );
}

export function getNotifications(actor: string, limit = 30, cursor?: string) {
  return getXrpc<{ items: SocialNotificationView[]; cursor?: string }>(
    "fm.teal.feed.social.getNotifications",
    { actor, limit, cursor },
  );
}

export function getActorPlaylists(actor: string, limit = 20, cursor?: string) {
  return getXrpc<{ items: SocialPlaylistView[]; cursor?: string }>(
    "fm.teal.feed.social.getActorPlaylists",
    { actor, limit, cursor },
  );
}

export function getGraphSummary(actor: string, viewer?: string) {
  return getXrpc<GraphSummaryView>("fm.teal.graph.getSummary", {
    actor,
    viewer,
  });
}

export function getGraphFollowers(actor: string, limit = 20, cursor?: string) {
  return getXrpc<{ actors: MiniProfileView[]; cursor?: string }>(
    "fm.teal.graph.getFollowers",
    { actor, limit, cursor },
  );
}

export function getGraphFollows(actor: string, limit = 20, cursor?: string) {
  return getXrpc<{ actors: MiniProfileView[]; cursor?: string }>(
    "fm.teal.graph.getFollows",
    { actor, limit, cursor },
  );
}

export function getPlaylist(uri: string, limit = 100, cursor?: string) {
  return getXrpc<{
    playlist: SocialPlaylistView;
    items: SocialPlaylistItemView[];
    cursor?: string;
  }>("fm.teal.feed.social.getPlaylist", { uri, limit, cursor });
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

// The Cover Art Archive only serves these thumbnail sizes. Any other size
// redirects to the original upload, which can be tens of megabytes.
const COVER_ART_SIZES = [250, 500, 1200] as const;

export function coverArtSize(size: number) {
  return COVER_ART_SIZES.find((option) => option >= size) ?? 1200;
}

function coverArtUrlFor(
  entity: "release" | "release-group",
  mbId?: string,
  size = 250,
) {
  const mbid = mbId?.replace(/^mbid:/, "");
  return mbid
    ? `https://coverartarchive.org/${entity}/${mbid}/front-${coverArtSize(size)}`
    : undefined;
}

export function coverArtUrl(releaseMbId?: string, size = 250) {
  return coverArtUrlFor("release", releaseMbId, size);
}

export function releaseGroupCoverArtUrl(releaseGroupMbId?: string, size = 250) {
  return coverArtUrlFor("release-group", releaseGroupMbId, size);
}

const recordingCoverArtCache = new Map<string, Promise<string | undefined>>();
const releaseGroupCoverArtCache = new Map<
  string,
  { expiresAt: number; request: Promise<string | undefined> }
>();
const artistImageCache = new Map<string, Promise<string | undefined>>();

export function getReleaseGroupCoverArtUrl(releaseMbId?: string, size = 250) {
  const mbid = releaseMbId?.replace(/^mbid:/, "");
  if (!mbid) return Promise.resolve(undefined);

  let cached = releaseGroupCoverArtCache.get(mbid);
  if (!cached || cached.expiresAt <= Date.now()) {
    if (!cached && releaseGroupCoverArtCache.size >= 1024) {
      const oldestKey = releaseGroupCoverArtCache.keys().next().value;
      if (oldestKey) releaseGroupCoverArtCache.delete(oldestKey);
    }
    const previousRequest = cached?.request;
    const entry = {
      expiresAt: Number.POSITIVE_INFINITY,
      request: Promise.resolve<string | undefined>(undefined),
    };
    entry.request = getXrpc<{ releaseGroupMbid?: string }>(
      "fm.teal.music.getReleaseGroup",
      { mbid: `mbid:${mbid}` },
    )
      .then(({ releaseGroupMbid }) => {
        entry.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
        return releaseGroupMbid;
      })
      .catch(() => {
        entry.expiresAt = Date.now() + 30 * 1000;
        return previousRequest ?? undefined;
      });
    releaseGroupCoverArtCache.set(mbid, entry);
    cached = entry;
  }
  return cached.request.then((groupMbid) =>
    releaseGroupCoverArtUrl(groupMbid, size),
  );
}

export function getRecordingCoverArtUrl(recordingMbId?: string, size = 250) {
  const mbid = recordingMbId?.replace(/^mbid:/, "");
  if (!mbid) return Promise.resolve(undefined);

  const cacheKey = `${mbid}:${size}`;
  let cached = recordingCoverArtCache.get(cacheKey);
  if (!cached) {
    cached = fetch(
      `https://musicbrainz.org/ws/2/recording/${encodeURIComponent(mbid)}?inc=releases&fmt=json`,
    )
      .then((response) => (response.ok ? response.json() : undefined))
      .then((recording?: { releases?: Array<{ id?: string }> }) => {
        const releaseId = recording?.releases?.find(
          (release) => release.id,
        )?.id;
        return releaseId ? coverArtUrl(releaseId, size) : undefined;
      })
      .catch(() => undefined)
      .then((url) => {
        // Keep hits for the session; a miss may be a passing outage, so let the next call ask again.
        if (!url) recordingCoverArtCache.delete(cacheKey);
        return url;
      });
    recordingCoverArtCache.set(cacheKey, cached);
  }
  return cached;
}

type MusicBrainzArtistRelations = {
  relations?: Array<{
    type?: string;
    url?: {
      resource?: string;
    };
  }>;
};

type WikidataEntityResponse = {
  entities?: Record<
    string,
    {
      claims?: {
        P18?: Array<{
          mainsnak?: {
            datavalue?: {
              value?: string;
            };
          };
        }>;
      };
    }
  >;
};

function extractWikidataId(resource?: string) {
  const match = resource?.match(/wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i);
  return match?.[1];
}

function commonsFilePath(filename: string, width: number) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;
}

export function getArtistImageUrl(artistMbId?: string, width = 500) {
  const mbid = artistMbId?.replace(/^mbid:/, "");
  if (!mbid) return Promise.resolve(undefined);

  const cacheKey = `${mbid}:${width}`;
  let cached = artistImageCache.get(cacheKey);
  if (!cached) {
    cached = fetch(
      `https://musicbrainz.org/ws/2/artist/${encodeURIComponent(mbid)}?inc=url-rels&fmt=json`,
    )
      .then((response) => (response.ok ? response.json() : undefined))
      .then((artist?: MusicBrainzArtistRelations) => {
        const wikidataId = artist?.relations
          ?.map((relation) => relation.url?.resource)
          .map(extractWikidataId)
          .find(Boolean);
        return wikidataId
          ? fetch(
              `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`,
            )
          : undefined;
      })
      .then((response) => (response?.ok ? response.json() : undefined))
      .then((data?: WikidataEntityResponse) => {
        const entity = data?.entities
          ? Object.values(data.entities)[0]
          : undefined;
        const filename = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        return filename ? commonsFilePath(filename, width) : undefined;
      })
      .catch(() => undefined)
      .then((url) => {
        // Keep hits for the session; a miss may be a passing outage, so let the next call ask again.
        if (!url) artistImageCache.delete(cacheKey);
        return url;
      });
    artistImageCache.set(cacheKey, cached);
  }
  return cached;
}

export function displayArtists(play: PlayView) {
  return play.artists.map((artist) => artist.artistName).join(", ");
}
