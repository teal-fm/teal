import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";
import type { ProfileView } from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import type { ArtistView, ReleaseView } from "@teal/lexicons/src/types/fm/teal/alpha/stats/defs";

const rawBase =
  process.env.EXPO_PUBLIC_AQUA_URL ||
  process.env.EXPO_PUBLIC_APPVIEW_URL ||
  "";
const demoFallbackEnabled = process.env.EXPO_PUBLIC_ENABLE_DEMO_FALLBACK === "true";

const requestBase =
  rawBase || (typeof window === "undefined" ? "http://localhost:3000" : window.location.origin);
const xrpcBase = requestBase.endsWith("/xrpc")
  ? requestBase
  : `${requestBase.replace(/\/$/, "")}/xrpc`;

const demoPlays: PlayView[] = [
  {
    uri: "at://did:plc:tealpreview/fm.teal.alpha.feed.play/3demo001",
    cid: "bafyreitealpreview001",
    authorDid: "did:plc:tealpreview",
    rkey: "3demo001",
    trackName: "Everything In Its Right Place",
    artists: [{ artistName: "Radiohead" }],
    releaseName: "Kid A",
    musicServiceBaseDomain: "music.apple.com",
    submissionClientAgent: "teal-preview/0.1",
    playedTime: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
  },
  {
    uri: "at://did:plc:amethystpreview/fm.teal.alpha.feed.play/3demo002",
    cid: "bafyreitealpreview002",
    authorDid: "did:plc:amethystpreview",
    rkey: "3demo002",
    trackName: "Archie, Marry Me",
    artists: [{ artistName: "Alvvays" }],
    releaseName: "Alvvays",
    musicServiceBaseDomain: "spotify.com",
    submissionClientAgent: "teal-preview/0.1",
    playedTime: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
  },
  {
    uri: "at://did:plc:cadetpreview/fm.teal.alpha.feed.play/3demo003",
    cid: "bafyreitealpreview003",
    authorDid: "did:plc:cadetpreview",
    rkey: "3demo003",
    trackName: "A Walk",
    artists: [{ artistName: "Tycho" }],
    releaseName: "Dive",
    musicServiceBaseDomain: "tidal.com",
    submissionClientAgent: "teal-preview/0.1",
    playedTime: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
  },
];

const demoArtists: ArtistView[] = [
  { name: "Radiohead", playCount: 128 },
  { name: "Alvvays", playCount: 96 },
  { name: "Tycho", playCount: 74 },
];

const demoReleases: ReleaseView[] = [
  { name: "Kid A", playCount: 42 },
  { name: "Alvvays", playCount: 31 },
  { name: "Dive", playCount: 26 },
];

function demoResponse<T>(method: string): T | undefined {
  if (!demoFallbackEnabled) return undefined;

  if (method === "fm.teal.alpha.stats.getLatest") return { plays: demoPlays } as T;
  if (method === "fm.teal.alpha.stats.getTopArtists") return { artists: demoArtists } as T;
  if (method === "fm.teal.alpha.stats.getTopReleases") return { releases: demoReleases } as T;

  return undefined;
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

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`${method} failed with ${response.status}`);
    }
    const result = (await response.json()) as T;
    const fallback = demoResponse<T>(method);
    if (
      fallback &&
      typeof result === "object" &&
      result !== null &&
      Object.values(result).some((value) => Array.isArray(value) && value.length === 0)
    ) {
      return fallback;
    }
    return result;
  } catch (error) {
    const fallback = demoResponse<T>(method);
    if (fallback) return fallback;
    throw error;
  }
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
