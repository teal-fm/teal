import { useEffect, useReducer, useRef, useState } from "react";

import { getProfilesFor, type PlaysWithProfiles } from "./api";
import { subscribe, type JetstreamEvent } from "./jetstream";
import { artistsOf, isObject, str } from "./records";
import type { Play, Profiles } from "./types";

const STABLE = "fm.teal.feed.play";
const COLLECTIONS = [STABLE, "fm.teal.alpha.feed.play"];

/** Imports write old plays in bulk; only plays from the last hour count as live. */
const MAX_AGE_MS = 60 * 60 * 1000;
const MAX_AHEAD_MS = 5 * 60 * 1000;

export type LiveStatus = "connecting" | "live" | "offline" | "paused";

/** Remembered per browser, so a paused feed stays paused across visits. */
const PAUSED_KEY = "teal:live-paused";

function readPaused() {
  try {
    return localStorage.getItem(PAUSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writePaused(paused: boolean) {
  try {
    if (paused) localStorage.setItem(PAUSED_KEY, "1");
    else localStorage.removeItem(PAUSED_KEY);
  } catch {
    // Storage can be off; pausing still works for this visit.
  }
}

/** A play, marked when it arrived over the socket rather than with the page. */
export type LivePlay = Play & { live?: boolean };

/**
 * Unix milliseconds for playedTime, read like play.lua does: ISO 8601 with or
 * without a zone (none means UTC) or a Unix number. Falls back to when the
 * event was seen.
 */
function playedAt(value: unknown, timeUs: number): number {
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(str(value) ?? "")) {
    const n = Number(value);
    return n > 1e11 ? n : n * 1000;
  }
  const text = str(value);
  if (text) {
    const zoned = /([zZ]|[+-]\d\d:?\d\d)\s*$/.test(text) ? text : `${text}Z`;
    const time = Date.parse(zoned);
    if (!Number.isNaN(time)) return time;
  }

  return timeUs / 1000;
}

/** Mirrors play_of in happyview/scripts/prelude.lua. */
function playOf(event: JetstreamEvent): LivePlay | undefined {
  const commit = event.commit;
  const record = commit?.record;
  if (!commit || !isObject(record)) return undefined;

  return {
    uri: `at://${event.did}/${commit.collection}/${commit.rkey}`,
    did: event.did,
    trackName: str(record.trackName) ?? "Untitled",
    artists: artistsOf(record),
    releaseName: str(record.releaseName),
    releaseMbId: str(record.releaseMbId),
    recordingMbId: str(record.recordingMbId),
    duration:
      typeof record.duration === "number"
        ? Math.floor(record.duration)
        : undefined,
    playedTime: new Date(
      playedAt(record.playedTime, event.time_us),
    ).toISOString(),
    originUrl: str(record.originUri) ?? str(record.originUrl),
    musicService:
      str(record.musicServiceUri) ?? str(record.musicServiceBaseDomain),
    client: str(record.submissionClientAgent),
    live: true,
  };
}

const timeOf = (play: Play) => Date.parse(play.playedTime ?? "") || 0;

/**
 * Clients that write both collections produce an alpha and a stable twin of
 * each play. This key matches the two, and keys rows so a twin swap doesn't
 * remount one.
 */
export const playKey = (play: Play) =>
  `${play.did}|${play.trackName}|${Math.round(timeOf(play) / 1000)}`;

const isStable = (play: Play) => play.uri.includes(`/${STABLE}/`);

function merge(current: LivePlay[], play: LivePlay, limit: number) {
  const key = playKey(play);
  const index = current.findIndex(
    (other) => other.uri === play.uri || playKey(other) === key,
  );
  if (index >= 0) {
    const existing = current[index];
    if (existing.uri !== play.uri && !isStable(play)) return current;
    const next = [...current];
    next[index] = { ...play, live: existing.live };

    return next;
  }

  return [...current, play]
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, limit);
}

/**
 * The newest `limit` plays: the server's first page, then every play that
 * arrives over Jetstream. The socket closes while the tab is hidden or the
 * feed is paused, and resumes from where it left off.
 */
export function useLivePlays(initial: PlaysWithProfiles, limit: number) {
  const [plays, setPlays] = useState<LivePlay[]>(() =>
    initial.plays.slice(0, limit),
  );
  const [profiles, setProfiles] = useState<Profiles>(initial.profiles);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  // Read from storage after mount, so the server render matches the first client one.
  const [paused, setPausedState] = useState<boolean | undefined>(undefined);
  const cursor = useRef<number | undefined>(undefined);
  // Re-renders "just now" into "2 min ago" as time passes.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const known = useRef(new Set(Object.keys(initial.profiles)));

  useEffect(() => setPausedState(readPaused()), []);

  const setPaused = (next: boolean) => {
    writePaused(next);
    setPausedState(next);
  };

  /** Applies the viewer's own edit (or deletion, with null) without waiting for the echo. */
  const replace = (uri: string, play: Play | null) =>
    setPlays((current) =>
      play
        ? current.map((other) =>
            other.uri === uri ? { ...play, live: other.live } : other,
          )
        : current.filter((other) => other.uri !== uri),
    );

  useEffect(() => {
    if (paused === undefined) return;
    if (paused) {
      setStatus("paused");
      return;
    }
    const clock = setInterval(tick, 30_000);
    let lookup: ReturnType<typeof setTimeout> | undefined;
    const wanted = new Set<string>();

    const lookUpProfiles = () => {
      lookup = undefined;
      const dids = [...wanted];
      wanted.clear();
      getProfilesFor({ data: { dids } })
        .then((found) => setProfiles((current) => ({ ...current, ...found })))
        .catch(() => {
          for (const did of dids) known.current.delete(did);
        });
    };

    const receive = (event: JetstreamEvent) => {
      const commit = event.commit;
      if (!commit || !COLLECTIONS.includes(commit.collection)) return;

      if (commit.operation === "delete") {
        const uri = `at://${event.did}/${commit.collection}/${commit.rkey}`;
        setPlays((current) => current.filter((play) => play.uri !== uri));
        return;
      }

      const play = playOf(event);
      if (!play) return;
      const age = Date.now() - timeOf(play);
      if (age > MAX_AGE_MS || age < -MAX_AHEAD_MS) return;

      setPlays((current) => merge(current, play, limit));
      if (!known.current.has(play.did)) {
        known.current.add(play.did);
        wanted.add(play.did);
        lookup ??= setTimeout(lookUpProfiles, 250);
      }
    };

    const unsubscribe = subscribe({
      collections: COLLECTIONS,
      cursor,
      onCommit: receive,
      onState: (state) =>
        setStatus(
          state === "open" ? "live" : state === "retrying" ? "offline" : state,
        ),
    });

    return () => {
      clearInterval(clock);
      clearTimeout(lookup);
      unsubscribe();
    };
  }, [limit, paused]);

  return { plays, profiles, status, paused: !!paused, setPaused, replace };
}
