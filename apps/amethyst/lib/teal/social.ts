import type { PlayView } from "@teal/lexicons/src/types/fm/teal/feed/defs";

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
      artistMbId: artist.artistMbId || artist.mbid || value.artistMbIds?.[index],
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
      .filter((mbid): mbid is string => Boolean(mbid)),
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
