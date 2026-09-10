import type { AppBskyActorDefs } from "@atproto/api";

import type {
  MiniProfileView,
  ProfileView,
} from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";
import type {
  AlbumView,
  ArtistListenerView,
  ArtistView as MusicArtistView,
} from "@teal/lexicons/src/types/fm/teal/alpha/music/defs";
import type { SongResult } from "@teal/lexicons/src/types/fm/teal/alpha/search/defs";
import type {
  ArtistView,
  RecordingView,
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
  | "7days"
  | "30days"
  | "90days"
  | "180days"
  | "365days"
  | "all";

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

export function getLatestPlays(limit = 50, cursor?: string) {
  return getXrpc<{ plays: PlayView[]; cursor?: string }>(
    "fm.teal.alpha.stats.getLatest",
    {
      limit,
      cursor,
    },
  );
}

export function getActorFeed(authorDID: string, limit = 30, cursor?: string) {
  return getXrpc<{ plays: PlayView[]; cursor?: string }>(
    "fm.teal.alpha.feed.getActorFeed",
    {
      authorDID,
      limit,
      cursor,
    },
  );
}

export function getPlayByUri(uri: string) {
  return getXrpc<{ play: PlayView }>("fm.teal.alpha.feed.getPlay", { uri });
}

export function getPlayByAuthorRkey(authorDID: string, rkey: string) {
  return getXrpc<{ play: PlayView }>("fm.teal.alpha.feed.getPlay", {
    authorDID,
    rkey,
  });
}

export function getArtist(mbid?: string, name?: string) {
  return getXrpc<{ artist: MusicArtistView }>("fm.teal.alpha.music.getArtist", {
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
    "fm.teal.alpha.music.getArtistListeners",
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
    "fm.teal.alpha.music.getAlbum",
    { mbid, limit, cursor },
  );
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

export function getUserTopArtists(
  actor: string,
  period: StatsPeriod = "90days",
  limit = 50,
  cursor?: string,
) {
  return getXrpc<{ artists: ArtistView[]; cursor?: string }>(
    "fm.teal.alpha.stats.getUserTopArtists",
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
    "fm.teal.alpha.stats.getUserTopReleases",
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
    "fm.teal.alpha.stats.getUserTopRecordings",
    { actor, period, limit, cursor },
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

export function getSocialFeed(
  limit = 30,
  cursor?: string,
  viewer?: string,
  actor?: string,
) {
  return getXrpc<{ items: SocialPostView[]; cursor?: string }>(
    "fm.teal.alpha.feed.social.getFeed",
    { limit, cursor, viewer, actor },
  );
}

export function getSocialPost(uri: string, viewer?: string) {
  return getXrpc<{ post: SocialPostView }>("fm.teal.alpha.feed.social.getPost", {
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
    "fm.teal.alpha.feed.social.getReplies",
    { uri, limit, cursor, viewer },
  );
}

export function getNotifications(actor: string, limit = 30, cursor?: string) {
  return getXrpc<{ items: SocialNotificationView[]; cursor?: string }>(
    "fm.teal.alpha.feed.social.getNotifications",
    { actor, limit, cursor },
  );
}

export function getActorPlaylists(actor: string, limit = 20, cursor?: string) {
  return getXrpc<{ items: SocialPlaylistView[]; cursor?: string }>(
    "fm.teal.alpha.feed.social.getActorPlaylists",
    { actor, limit, cursor },
  );
}

export function getGraphSummary(actor: string, viewer?: string) {
  return getXrpc<GraphSummaryView>("fm.teal.alpha.graph.getSummary", {
    actor,
    viewer,
  });
}

export function getGraphFollowers(actor: string, limit = 20, cursor?: string) {
  return getXrpc<{ actors: MiniProfileView[]; cursor?: string }>(
    "fm.teal.alpha.graph.getFollowers",
    { actor, limit, cursor },
  );
}

export function getGraphFollows(actor: string, limit = 20, cursor?: string) {
  return getXrpc<{ actors: MiniProfileView[]; cursor?: string }>(
    "fm.teal.alpha.graph.getFollows",
    { actor, limit, cursor },
  );
}

export function getPlaylist(uri: string, limit = 100, cursor?: string) {
  return getXrpc<{
    playlist: SocialPlaylistView;
    items: SocialPlaylistItemView[];
    cursor?: string;
  }>("fm.teal.alpha.feed.social.getPlaylist", { uri, limit, cursor });
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

const recordingCoverArtCache = new Map<string, Promise<string | undefined>>();
const artistImageCache = new Map<string, Promise<string | undefined>>();

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
        const releaseId = recording?.releases?.find((release) => release.id)?.id;
        return releaseId ? coverArtUrl(releaseId, size) : undefined;
      })
      .catch(() => undefined);
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
      .then((response) => response?.ok ? response.json() : undefined)
      .then((data?: WikidataEntityResponse) => {
        const entity = data?.entities ? Object.values(data.entities)[0] : undefined;
        const filename =
          entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        return filename ? commonsFilePath(filename, width) : undefined;
      })
      .catch(() => undefined);
    artistImageCache.set(cacheKey, cached);
  }
  return cached;
}

export function displayArtists(play: PlayView) {
  return play.artists.map((artist) => artist.artistName).join(", ");
}
