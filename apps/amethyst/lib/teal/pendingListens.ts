import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type { Main as PlayRecord } from "@teal/lexicons/src/fm/teal/feed/play";

export const PENDING_LISTEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_PENDING_LISTENS_PER_ACTOR = 200;
export const MAX_PENDING_LISTEN_ACTORS = 8;
const STORAGE_KEY = "teal.confirmed-listens.v1";
const MAX_STORED_CHARACTERS = 1_500_000;

export type ConfirmedListenWrite = {
  record: PlayRecord;
  uri: string;
  cid: string;
};

export type PendingListen = {
  play: PlayView;
  savedAt: number;
};

export type PendingListenStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
};

function recordKey(actor: string, uri: string) {
  if (!/^did:[a-z]+:[^/\s]+$/.test(actor)) return undefined;
  const prefix = `at://${actor}/fm.teal.feed.play/`;
  const rkey = uri.startsWith(prefix) ? uri.slice(prefix.length) : "";
  return /^[A-Za-z0-9._~:-]+$/.test(rkey) && rkey !== "." && rkey !== ".."
    ? rkey
    : undefined;
}

function isOptionalTimestamp(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)))
  );
}

function comparePlayedTime(a: PlayView, b: PlayView) {
  const first = Date.parse(a.playedTime || "");
  const second = Date.parse(b.playedTime || "");
  if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
  if (!Number.isFinite(second)) return -1;
  return second - first;
}

function confirmedPlay(
  actor: string,
  { record, uri, cid }: ConfirmedListenWrite,
): PlayView | undefined {
  const rkey = recordKey(actor, uri);
  if (
    !rkey ||
    !cid ||
    !record.trackName ||
    !isOptionalTimestamp(record.playedTime)
  )
    return undefined;
  return {
    $type: "fm.teal.feed.defs#playView",
    trackName: record.trackName,
    trackMbId: record.trackMbId,
    recordingMbId: record.recordingMbId,
    duration: record.duration,
    releaseName: record.releaseName,
    releaseMbId: record.releaseMbId,
    isrc: record.isrc,
    originUri: record.originUri,
    musicServiceUri: record.musicServiceUri,
    submissionClientAgent: record.submissionClientAgent,
    playedTime: record.playedTime,
    uri: uri as PlayView["uri"],
    cid,
    rkey,
    authorDid: actor as PlayView["authorDid"],
    artists:
      record.artists ||
      (record.artistNames || []).map((artistName, index) => ({
        artistName,
        artistMbId: record.artistMbIds?.[index]
          ? `mbid:${record.artistMbIds[index].replace(/^mbid:/, "")}`
          : undefined,
      })),
  };
}

function pruneEntries(entries: readonly PendingListen[], now: number) {
  const actors = new Map<string, number>();
  let storedCharacters = 0;
  const seen = new Set<string>();
  const unique = entries.filter((entry) => {
    if (!entry.play.uri || seen.has(entry.play.uri)) return false;
    seen.add(entry.play.uri);
    return true;
  });
  return unique
    .sort((a, b) => b.savedAt - a.savedAt || comparePlayedTime(a.play, b.play))
    .filter((entry) => {
      const { uri, authorDid } = entry.play;
      if (
        !uri ||
        !authorDid ||
        now - entry.savedAt >= PENDING_LISTEN_RETENTION_MS ||
        entry.savedAt > now + 60_000
      )
        return false;
      const count = actors.get(authorDid) || 0;
      if (
        (!count && actors.size >= MAX_PENDING_LISTEN_ACTORS) ||
        count >= MAX_PENDING_LISTENS_PER_ACTOR
      )
        return false;
      const characters = JSON.stringify(entry).length;
      if (storedCharacters + characters > MAX_STORED_CHARACTERS) return false;
      storedCharacters += characters;
      actors.set(authorDid, count + 1);
      return true;
    });
}

function restoreEntries(raw: string | null): PendingListen[] {
  if (!raw || raw.length > 2_000_000) return [];
  try {
    const value = JSON.parse(raw) as { version?: unknown; listens?: unknown };
    if (value?.version !== 1 || !Array.isArray(value.listens)) return [];
    return value.listens.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== "object") return [];
      const { play, savedAt } = entry as Partial<PendingListen>;
      if (
        !play ||
        typeof play !== "object" ||
        !Number.isFinite(savedAt) ||
        typeof play.uri !== "string" ||
        typeof play.authorDid !== "string" ||
        !recordKey(play.authorDid, play.uri) ||
        typeof play.cid !== "string" ||
        !play.cid ||
        typeof play.trackName !== "string" ||
        !play.trackName ||
        play.trackName.length > 256 ||
        !isOptionalTimestamp(play.playedTime) ||
        !Array.isArray(play.artists) ||
        play.artists.length > 50 ||
        play.artists.some(
          (artist) =>
            !artist ||
            typeof artist.artistName !== "string" ||
            artist.artistName.length > 256 ||
            (artist.artistMbId !== undefined &&
              typeof artist.artistMbId !== "string"),
        ) ||
        [
          play.releaseName,
          play.releaseMbId,
          play.recordingMbId,
          play.trackMbId,
          play.musicServiceUri,
          play.originUri,
          play.submissionClientAgent,
          play.isrc,
        ].some((field) => field !== undefined && typeof field !== "string") ||
        (play.duration !== undefined && !Number.isFinite(play.duration))
      )
        return [];
      const sanitized = confirmedPlay(play.authorDid, {
        record: { ...play, $type: "fm.teal.feed.play" },
        uri: play.uri,
        cid: play.cid,
      });
      return sanitized ? [{ play: sanitized, savedAt: savedAt as number }] : [];
    });
  } catch {
    return [];
  }
}

/** Keep confirmed writes visible while the AppView catches up. Never create a listen here. */
export function createPendingListenStore(
  storage?: PendingListenStorage,
  now: () => number = Date.now,
) {
  let snapshot: readonly PendingListen[] = [];
  const listeners = new Set<() => void>();
  const retiredDuringHydration = new Map<string, Set<string>>();
  const removedDuringHydration = new Set<string>();
  let hydration: Promise<void> | undefined;
  let hydrated = false;
  let writes = Promise.resolve();

  function publish(next: readonly PendingListen[]) {
    if (
      next.length === snapshot.length &&
      next.every((entry, index) => entry === snapshot[index])
    )
      return;
    snapshot = next;
    for (const listener of listeners) listener();
  }
  function persist() {
    if (!storage || !hydrated) return;
    const data = JSON.stringify({ version: 1, listens: snapshot });
    // Serialize storage writes so an older save can never replace newer state.
    writes = writes
      .then(() => storage.setItem(STORAGE_KEY, data))
      .then(() => undefined)
      .catch(() => undefined);
  }
  function hydrate(): Promise<void> {
    if (!hydration)
      hydration = (async () => {
        const raw = storage
          ? await storage.getItem(STORAGE_KEY).catch(() => null)
          : null;
        const restored = restoreEntries(raw).filter(
          (entry) =>
            !removedDuringHydration.has(entry.play.uri!) &&
            !retiredDuringHydration.get(entry.play.uri!)?.has(entry.play.cid!),
        );
        // A write completed while storage was loading takes precedence over its older saved copy.
        publish(pruneEntries([...snapshot, ...restored], now()));
        retiredDuringHydration.clear();
        removedDuringHydration.clear();
        hydrated = true;
        persist();
      })();
    return hydration;
  }
  return {
    hydrate,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    addConfirmed(actor: string, confirmed: readonly ConfirmedListenWrite[]) {
      const savedAt = now();
      const next = confirmed.flatMap((write) => {
        const play = confirmedPlay(actor, write);
        return play ? [{ play, savedAt }] : [];
      });
      publish(pruneEntries([...next, ...snapshot], savedAt));
      persist();
      void hydrate();
    },
    retireIndexed(
      actor: string,
      indexed: readonly Pick<PlayView, "uri" | "authorDid" | "cid">[],
    ) {
      const versions = new Map(
        indexed
          .filter((play) => !play.authorDid || play.authorDid === actor)
          .flatMap((play) =>
            play.uri && play.cid && recordKey(actor, play.uri)
              ? [[play.uri, play.cid] as const]
              : [],
          ),
      );
      if (!hydrated)
        for (const [uri, cid] of versions) {
          const cids = retiredDuringHydration.get(uri) || new Set<string>();
          cids.add(cid);
          retiredDuringHydration.set(uri, cids);
        }
      publish(
        pruneEntries(
          snapshot.filter(
            (entry) =>
              entry.play.authorDid !== actor ||
              versions.get(entry.play.uri!) !== entry.play.cid,
          ),
          now(),
        ),
      );
      persist();
      void hydrate();
    },
    removeConfirmed(actor: string, uris: readonly string[]) {
      const ownUris = new Set(uris.filter((uri) => recordKey(actor, uri)));
      if (!hydrated) for (const uri of ownUris) removedDuringHydration.add(uri);
      publish(
        pruneEntries(
          snapshot.filter((entry) => !ownUris.has(entry.play.uri!)),
          now(),
        ),
      );
      persist();
      void hydrate();
    },
    prune() {
      publish(pruneEntries(snapshot, now()));
      persist();
    },
    async flush() {
      await hydrate();
      await writes;
    },
  };
}

/** Use local confirmed edits until the index returns the same CID. */
export function mergePendingListens(
  actor: string,
  indexed: readonly PlayView[],
  pending: readonly PendingListen[],
): PlayView[] {
  const local = new Map(
    pending
      .filter((entry) => entry.play.authorDid === actor)
      .map((entry) => [entry.play.uri, entry.play]),
  );
  const seen = new Set<string>();
  return [
    ...indexed.map((play) => {
      const confirmed = play.uri ? local.get(play.uri) : undefined;
      return confirmed && confirmed.cid !== play.cid ? confirmed : play;
    }),
    ...local.values(),
  ]
    .filter((play) => {
      if (!play.uri) return true;
      if (seen.has(play.uri)) return false;
      seen.add(play.uri);
      return true;
    })
    .sort(comparePlayedTime);
}

export function searchPendingListens(
  actor: string,
  query: string,
  pending: readonly PendingListen[],
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return pending
    .filter(({ play }) => {
      const text = [
        play.trackName,
        play.releaseName,
        ...play.artists.map((artist) => artist.artistName),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        play.authorDid === actor && terms.every((term) => text.includes(term))
      );
    })
    .map(({ play }) => play);
}
