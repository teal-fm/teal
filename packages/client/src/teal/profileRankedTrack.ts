import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type { SongResult } from "@teal/lexicons/src/fm/teal/search/defs";

import { indexedStatContext } from "./profileStats";
import { musicTrackHref, parseAtUri } from "./routes";

const HISTORY_PAGES_PER_LOOKUP = 4;
const HISTORY_PAGE_SIZE = 50;

export type RankedTrackContinuation = {
  searched: boolean;
  cursor?: string;
  exhausted?: boolean;
};

type TrackContext = { artist: string; href?: string };
export type RankedTrackResolution = RankedTrackContinuation & {
  context?: TrackContext;
};

type Dependencies = {
  search: (query: string, actor: string) => Promise<{ songs: SongResult[] }>;
  history: (
    actor: string,
    limit: number,
    cursor?: string,
  ) => Promise<{ plays: PlayView[]; cursor?: string }>;
};

const identity = (value?: string) => value?.replace(/^mbid:/, "").toLowerCase();

function actorOwnsListen(uri: string | undefined, actor: string) {
  const record = parseAtUri(uri);
  return (
    record?.did === actor &&
    record.collection === "fm.teal.feed.play" &&
    Boolean(record.rkey)
  );
}

/** Search all indexed dates first. If capped search misses the identity, resume a bounded history scan. */
export async function resolveRankedTrack(
  actorDid: string,
  recordingMbid: string,
  title: string,
  continuation: RankedTrackContinuation | undefined,
  deps: Dependencies,
  isCurrent = () => true,
): Promise<RankedTrackResolution> {
  const target = identity(recordingMbid);
  if (!target) throw new Error("This ranking does not identify a recording.");
  let searched = continuation?.searched || false;
  if (!searched) {
    try {
      const results = await deps.search(
        Array.from(title).slice(0, 128).join(""),
        actorDid,
      );
      if (!isCurrent()) return { searched: false };
      const song = results.songs.find(
        (candidate) =>
          identity(candidate.recordingMbId) === target &&
          actorOwnsListen(candidate.uri, actorDid),
      );
      if (song)
        return {
          searched: true,
          context: {
            artist: song.artistName,
            href: musicTrackHref(
              song.artistName || "music",
              song.releaseName,
              song.trackName,
              song.uri,
            ),
          },
        };
      searched = true;
    } catch {
      // A search outage does not prevent an exact match in the actor's indexed history.
      if (!isCurrent()) return { searched: false };
    }
  }
  if (continuation?.exhausted) return { searched, exhausted: true };
  let cursor = continuation?.cursor;
  const seen = new Set(cursor ? [cursor] : []);
  for (
    let pageIndex = 0;
    pageIndex < HISTORY_PAGES_PER_LOOKUP && isCurrent();
    pageIndex += 1
  ) {
    const page = await deps.history(actorDid, HISTORY_PAGE_SIZE, cursor);
    if (!isCurrent()) return { searched, cursor };
    const context = indexedStatContext(
      "tracks",
      recordingMbid,
      page.plays.filter((play) => actorOwnsListen(play.uri, actorDid)),
    );
    if (context?.href) return { searched, context, cursor: page.cursor };
    if (!page.cursor) return { searched, exhausted: true };
    if (seen.has(page.cursor))
      throw new Error("Listening history could not advance. Try again later.");
    seen.add(page.cursor);
    cursor = page.cursor;
  }
  return { searched, cursor };
}
