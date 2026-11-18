import { useEffect, useReducer, useRef, useState } from "react";

import { getProfilesFor, type PlaysWithProfiles } from "./api";
import type { Play, Profiles } from "./types";

/**
 * HappyView only answers queries, so live plays come straight from Bluesky's
 * public Jetstream, filtered to the two play collections. On failure the
 * socket moves to the next instance.
 */
const JETSTREAMS = [
  "wss://jetstream2.us-east.bsky.network",
  "wss://jetstream1.us-east.bsky.network",
  "wss://jetstream2.us-west.bsky.network",
  "wss://jetstream1.us-west.bsky.network",
];
const STABLE = "fm.teal.feed.play";
const COLLECTIONS = [STABLE, "fm.teal.alpha.feed.play"];

/** Imports write old plays in bulk; only plays from the last hour count as live. */
const MAX_AGE_MS = 60 * 60 * 1000;
const MAX_AHEAD_MS = 5 * 60 * 1000;

export type LiveStatus = "connecting" | "live" | "offline";

/** A play, marked when it arrived over the socket rather than with the page. */
export type LivePlay = Play & { live?: boolean };

interface JetstreamEvent {
  did: string;
  time_us: number;
  kind: string;
  commit?: {
    operation: "create" | "update" | "delete";
    collection: string;
    rkey: string;
    record?: Record<string, unknown>;
  };
}

const str = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Mirrors artists_of in happyview/scripts/prelude.lua. */
function artistsOf(record: Record<string, unknown>): string[] {
  const names = Array.isArray(record.artists)
    ? record.artists
        .map((artist) =>
          isObject(artist)
            ? (str(artist.artistName) ?? str(artist.name))
            : undefined,
        )
        .filter((name): name is string => name !== undefined)
    : [];
  if (names.length > 0) return names;

  return Array.isArray(record.artistNames)
    ? record.artistNames.filter((name): name is string => !!str(name))
    : [];
}

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

function parse(data: unknown): JetstreamEvent | undefined {
  if (typeof data !== "string") return undefined;
  try {
    const event = JSON.parse(data) as JetstreamEvent;
    return typeof event.did === "string" && typeof event.time_us === "number"
      ? event
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The newest `limit` plays: the server's first page, then every play that
 * arrives over Jetstream. The socket closes while the tab is hidden and
 * resumes from where it left off.
 */
export function useLivePlays(initial: PlaysWithProfiles, limit: number) {
  const [plays, setPlays] = useState<LivePlay[]>(() =>
    initial.plays.slice(0, limit),
  );
  const [profiles, setProfiles] = useState<Profiles>(initial.profiles);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  // Re-renders "just now" into "2 min ago" as time passes.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const known = useRef(new Set(Object.keys(initial.profiles)));

  useEffect(() => {
    const clock = setInterval(tick, 30_000);
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let lookup: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let cursor: number | undefined;
    let stopped = false;
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
      if (event.kind !== "commit" || !commit) return;
      if (!COLLECTIONS.includes(commit.collection)) return;

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

    const connect = () => {
      if (stopped || document.hidden || socket) return;
      setStatus("connecting");
      const url = new URL(
        "/subscribe",
        JETSTREAMS[attempt % JETSTREAMS.length],
      );
      for (const collection of COLLECTIONS) {
        url.searchParams.append("wantedCollections", collection);
      }
      if (cursor) url.searchParams.set("cursor", String(cursor));

      const ws = new WebSocket(url);
      socket = ws;
      ws.onopen = () => {
        attempt = 0;
        setStatus("live");
      };
      ws.onmessage = (message) => {
        const event = parse(message.data);
        if (!event) return;
        cursor = event.time_us;
        receive(event);
      };
      ws.onclose = () => {
        if (socket !== ws) return;
        socket = undefined;
        if (stopped || document.hidden) return;
        setStatus("offline");
        attempt += 1;
        retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt));
      };
    };

    const disconnect = () => {
      clearTimeout(retry);
      const ws = socket;
      socket = undefined;
      ws?.close();
    };

    const onVisibility = () => {
      if (document.hidden) {
        disconnect();
      } else {
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      clearInterval(clock);
      clearTimeout(lookup);
      disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [limit]);

  return { plays, profiles, status };
}
