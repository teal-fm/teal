import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import { displayArtists } from "./api";
import { musicAlbumHref, musicTrackHref } from "./routes";

function identity(value?: string) {
  return value?.replace(/^mbid:/, "").toLowerCase();
}

/** Only attach music context when the recording/release identity matches exactly. */
export function indexedStatContext(
  kind: "albums" | "tracks",
  mbid: string | undefined,
  plays: PlayView[],
) {
  const target = identity(mbid);
  if (!target) return undefined;
  const play = plays.find(
    (candidate) =>
      identity(
        kind === "albums" ? candidate.releaseMbId : candidate.recordingMbId,
      ) === target,
  );
  if (!play) return undefined;
  const artist = displayArtists(play);
  return {
    artist,
    href:
      kind === "albums" && play.releaseMbId
        ? musicAlbumHref(
            artist || "music",
            play.releaseName || "Unknown album",
            play.releaseMbId,
          )
        : play.uri
          ? musicTrackHref(
              artist || "music",
              play.releaseName,
              play.trackName,
              play.uri,
            )
          : undefined,
  };
}

/** Cursor pages may overlap while the live index changes. Keep each record once. */
export function appendUniqueRecords<T extends { uri?: string }>(
  current: T[],
  next: T[],
) {
  const seen = new Set(current.flatMap((item) => (item.uri ? [item.uri] : [])));
  return [
    ...current,
    ...next.filter((item) => {
      if (!item.uri) return true;
      if (seen.has(item.uri)) return false;
      seen.add(item.uri);
      return true;
    }),
  ];
}

type ProfileRequestIdentity = {
  generation: number;
  actor?: string;
  targetDid: string | null;
  viewerDid?: string;
};

/** A completed mutation belongs only to the profile and viewer that started it. */
export function isCurrentProfileRequest(
  request: ProfileRequestIdentity,
  current: ProfileRequestIdentity,
) {
  return (
    request.generation === current.generation &&
    request.actor === current.actor &&
    request.targetDid === current.targetDid &&
    request.viewerDid === current.viewerDid
  );
}
