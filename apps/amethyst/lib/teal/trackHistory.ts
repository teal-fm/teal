import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

const normalize = (value?: string) =>
  (value || "").normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
const mbid = (value: string) => value.replace(/^mbid:/, "").toLowerCase();

export function matchesTrack(candidate: PlayView, selected: PlayView) {
  if (candidate.recordingMbId && selected.recordingMbId) {
    return mbid(candidate.recordingMbId) === mbid(selected.recordingMbId);
  }
  const artists = (play: PlayView) =>
    play.artists.map((artist) => normalize(artist.artistName)).join(", ");
  return (
    normalize(candidate.trackName) === normalize(selected.trackName) &&
    artists(candidate) === artists(selected) &&
    normalize(candidate.releaseName) === normalize(selected.releaseName)
  );
}

export function appendTrackHistory(
  current: PlayView[],
  page: PlayView[],
  selected: PlayView,
) {
  const seen = new Set(current.map((play) => play.uri));
  return [
    ...current,
    ...page.filter((play) => {
      if (
        !matchesTrack(play, selected) ||
        play.uri === selected.uri ||
        seen.has(play.uri)
      )
        return false;
      seen.add(play.uri);
      return true;
    }),
  ];
}
