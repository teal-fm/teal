import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

/** Only the author's exact post record may be removed from their repository. */
export function socialPostDeleteParams(
  uri: string,
  viewerDid: string,
  cid: string,
) {
  const match =
    /^at:\/\/([^/]+)\/fm\.teal\.feed\.social\.post\/([A-Za-z0-9._~:-]+)$/.exec(
      uri,
    );
  if (
    !match ||
    match[1] !== viewerDid ||
    !viewerDid.startsWith("did:") ||
    !cid ||
    match[2] === "." ||
    match[2] === ".."
  ) {
    throw new Error("Only your own Teal post can be deleted.");
  }
  return {
    repo: viewerDid,
    collection: "fm.teal.feed.social.post",
    rkey: match[2],
    swapRecord: cid,
  };
}

type TrackArtist = {
  artistName?: string;
  name?: string;
  artistMbId?: string;
  mbid?: string;
};

export type TrackViewLike = {
  trackName?: string;
  trackMbId?: string;
  recordingMbId?: string;
  duration?: number;
  artistNames?: string[];
  artistMbIds?: string[];
  artists?: TrackArtist[];
  releaseName?: string;
  releaseMbId?: string;
  isrc?: string;
  originUri?: string;
};

export function trackViewToPlayView(track: unknown): PlayView {
  const value = (track || {}) as TrackViewLike;
  const artists =
    value.artists?.map((artist, index) => ({
      artistName:
        artist.artistName ||
        artist.name ||
        value.artistNames?.[index] ||
        "Unknown artist",
      artistMbId:
        artist.artistMbId || artist.mbid || value.artistMbIds?.[index],
    })) ||
    value.artistNames?.map((artistName, index) => ({
      artistName,
      artistMbId: value.artistMbIds?.[index],
    })) ||
    [];

  return {
    trackName: value.trackName || "Unknown track",
    trackMbId: value.trackMbId,
    recordingMbId: value.recordingMbId || value.trackMbId,
    duration: value.duration,
    artists,
    releaseName: value.releaseName,
    releaseMbId: value.releaseMbId,
    isrc: value.isrc,
    originUri: value.originUri,
  } as PlayView;
}

export function playViewToTrackView(play: PlayView): TrackViewLike {
  return {
    trackName: play.trackName,
    trackMbId: play.trackMbId,
    recordingMbId: play.recordingMbId,
    duration: play.duration,
    artistNames: play.artists.map((artist) => artist.artistName),
    artistMbIds: play.artists
      .map((artist) => artist.artistMbId)
      .filter((mbid): mbid is NonNullable<typeof mbid> => Boolean(mbid)),
    artists: play.artists.map((artist) => ({
      artistName: artist.artistName,
      artistMbId: artist.artistMbId,
    })),
    releaseName: play.releaseName,
    releaseMbId: play.releaseMbId,
    isrc: play.isrc,
    originUri: play.originUri,
  };
}
