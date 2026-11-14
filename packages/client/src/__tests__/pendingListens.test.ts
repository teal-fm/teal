import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import { submitManualListenRecords } from "../manualListens";
import {
  createPendingListenStore,
  MAX_PENDING_LISTEN_ACTORS,
  MAX_PENDING_LISTENS_PER_ACTOR,
  mergePendingListens,
  PENDING_LISTEN_RETENTION_MS,
  searchPendingListens,
  type ConfirmedListenWrite,
  type PendingListenStorage,
} from "../teal/pendingListens";

const NOW = Date.parse("2026-10-17T12:00:00.000Z");
const ACTOR = "did:plc:first";
const OTHER = "did:plc:second";

function confirmed(
  actor = ACTOR,
  rkey = "3test",
  title = "London Song",
): ConfirmedListenWrite {
  return {
    uri: `at://${actor}/fm.teal.feed.play/${rkey}`,
    cid: `bafy${rkey}`,
    record: {
      $type: "fm.teal.feed.play",
      trackName: title,
      recordingMbId: "mbid:recording",
      releaseName: "I Love My Computer",
      artists: [{ artistName: "Ninajirachi" }],
      playedTime: new Date(
        NOW - 1000,
      ).toISOString() as ConfirmedListenWrite["record"]["playedTime"],
    },
  };
}

function memoryStorage(): PendingListenStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItem(key) {
      return data.get(key) || null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
  };
}

it("persists real confirmed listens across store recreation and isolates actors", async () => {
  const storage = memoryStorage();
  const before = createPendingListenStore(storage, () => NOW);
  before.addConfirmed(ACTOR, [confirmed()]);
  before.addConfirmed(OTHER, [confirmed(OTHER)]);
  await before.flush();
  const after = createPendingListenStore(storage, () => NOW + 1000);
  await after.hydrate();
  expect(
    mergePendingListens(ACTOR, [], after.getSnapshot()).map((play) => play.uri),
  ).toEqual([confirmed().uri]);
  expect(
    searchPendingListens(OTHER, "London Ninajirachi", after.getSnapshot()).map(
      (play) => play.uri,
    ),
  ).toEqual([confirmed(OTHER).uri]);
});

it("deduplicates confirmations by URI while preserving distinct listens of the same track", () => {
  const store = createPendingListenStore(undefined, () => NOW);
  store.addConfirmed(ACTOR, [confirmed(), confirmed(ACTOR, "3another")]);
  store.addConfirmed(ACTOR, [confirmed()]);
  expect(store.getSnapshot()).toHaveLength(2);
});

it("uses the indexed version on readback and retires only the matching actor's URIs", () => {
  const store = createPendingListenStore(undefined, () => NOW);
  store.addConfirmed(ACTOR, [confirmed()]);
  store.addConfirmed(OTHER, [confirmed(OTHER)]);
  const local = store
    .getSnapshot()
    .find((entry) => entry.play.authorDid === ACTOR)!.play;
  const indexed = { ...local, trackName: "Canonical title" };
  expect(
    mergePendingListens(ACTOR, [indexed, indexed], store.getSnapshot()),
  ).toEqual([indexed]);
  store.retireIndexed(OTHER, [indexed]);
  expect(store.getSnapshot()).toHaveLength(2);
  store.retireIndexed(ACTOR, [indexed]);
  expect(store.getSnapshot().map((entry) => entry.play.authorDid)).toEqual([
    OTHER,
  ]);
});

it("expires by confirmation age, including old historical listens saved today", () => {
  let now = NOW;
  const store = createPendingListenStore(undefined, () => now);
  const historical = confirmed();
  historical.record.playedTime = "2005-06-02T12:00:00.000Z";
  store.addConfirmed(ACTOR, [historical]);
  now += PENDING_LISTEN_RETENTION_MS - 1;
  store.prune();
  expect(store.getSnapshot()).toHaveLength(1);
  now += 1;
  store.prune();
  expect(store.getSnapshot()).toEqual([]);
});

it("bounds records per actor and the total number of retained accounts", () => {
  let now = NOW;
  const store = createPendingListenStore(undefined, () => now);
  store.addConfirmed(
    ACTOR,
    Array.from({ length: MAX_PENDING_LISTENS_PER_ACTOR + 1 }, (_, i) =>
      confirmed(ACTOR, `3listen${i}`),
    ),
  );
  expect(store.getSnapshot()).toHaveLength(MAX_PENDING_LISTENS_PER_ACTOR);
  for (let i = 0; i < MAX_PENDING_LISTEN_ACTORS; i++) {
    now += 1000;
    const actor = `did:plc:account${i}`;
    store.addConfirmed(actor, [confirmed(actor)]);
  }
  expect(
    new Set(store.getSnapshot().map((entry) => entry.play.authorDid)).size,
  ).toBe(MAX_PENDING_LISTEN_ACTORS);
  expect(
    store.getSnapshot().some((entry) => entry.play.authorDid === ACTOR),
  ).toBe(false);
});

it("rejects another repository's receipt, missing CIDs, and malformed record links", () => {
  const store = createPendingListenStore(undefined, () => NOW);
  store.addConfirmed(ACTOR, [
    confirmed(OTHER),
    { ...confirmed(), cid: "" },
    { ...confirmed(), uri: `${confirmed().uri}/extra` },
  ]);
  expect(store.getSnapshot()).toEqual([]);
});

it("preserves writes and retirements that happen before async hydration finishes", async () => {
  const initial = memoryStorage();
  const seed = createPendingListenStore(initial, () => NOW);
  seed.addConfirmed(ACTOR, [confirmed(), confirmed(ACTOR, "3retire")]);
  await seed.flush();
  let finishRead: (value: string | null) => void = () => {};
  const delayed = {
    getItem: () =>
      new Promise<string | null>((resolve) => {
        finishRead = resolve;
      }),
    setItem: initial.setItem,
  };
  const store = createPendingListenStore(delayed, () => NOW + 1000);
  const hydration = store.hydrate();
  store.addConfirmed(ACTOR, [confirmed(ACTOR, "3new")]);
  store.retireIndexed(ACTOR, [
    {
      uri: confirmed(ACTOR, "3retire").uri as PlayView["uri"],
      cid: confirmed(ACTOR, "3retire").cid,
    },
  ]);
  finishRead([...initial.data.values()][0]);
  await hydration;
  expect(
    store
      .getSnapshot()
      .map((entry) => entry.play.uri)
      .sort(),
  ).toEqual([confirmed().uri, confirmed(ACTOR, "3new").uri].sort());
});

it("does not fail a confirmed save when local persistence is unavailable", async () => {
  const store = createPendingListenStore(
    {
      async getItem() {
        throw new Error("Storage blocked");
      },
      async setItem() {
        throw new Error("Storage full");
      },
    },
    () => NOW,
  );
  store.addConfirmed(ACTOR, [confirmed()]);
  await store.flush();
  expect(store.getSnapshot()).toHaveLength(1);
});

it("ignores malformed persisted data instead of showing invented history", async () => {
  for (const raw of [
    "not JSON",
    JSON.stringify({
      version: 1,
      listens: [{ play: { uri: "at://fake" }, savedAt: NOW }],
    }),
  ]) {
    const store = createPendingListenStore(
      {
        async getItem() {
          return raw;
        },
        async setItem() {},
      },
      () => NOW,
    );
    await store.hydrate();
    expect(store.getSnapshot()).toEqual([]);
  }
});

it("retains only successfully committed manual-listen receipts", async () => {
  const store = createPendingListenStore(undefined, () => NOW);
  const write = confirmed();
  const agent = {
    did: ACTOR,
    async call() {
      return { data: { results: [{ uri: write.uri, cid: write.cid }] } };
    },
  };
  await expect(
    submitManualListenRecords(agent, [write.record], (writes) =>
      store.addConfirmed(ACTOR, writes),
    ),
  ).resolves.toBe(1);
  expect(store.getSnapshot().map((entry) => entry.play.uri)).toEqual([
    write.uri,
  ]);
  const failing = {
    did: OTHER,
    async call(): Promise<{ data: unknown }> {
      throw new Error("PDS unavailable");
    },
  };
  await expect(
    submitManualListenRecords(failing, [confirmed(OTHER).record], (writes) =>
      store.addConfirmed(OTHER, writes),
    ),
  ).rejects.toThrow("PDS unavailable");
  expect(
    store.getSnapshot().every((entry) => entry.play.authorDid === ACTOR),
  ).toBe(true);
});

it("does not turn a retention callback failure into a duplicate-write retry", async () => {
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  const write = confirmed();
  const agent = {
    did: ACTOR,
    async call() {
      return { data: { results: [{ uri: write.uri, cid: write.cid }] } };
    },
  };
  await expect(
    submitManualListenRecords(agent, [write.record], () => {
      throw new Error("Device storage failed");
    }),
  ).resolves.toBe(1);
  warning.mockRestore();
});

it("does not retain a PDS response explicitly marked unsuccessful", async () => {
  const store = createPendingListenStore(undefined, () => NOW);
  const write = confirmed();
  const agent = {
    did: ACTOR,
    async call() {
      return {
        success: false,
        data: { results: [{ uri: write.uri, cid: write.cid }] },
      };
    },
  };
  await expect(
    submitManualListenRecords(agent, [write.record], (writes) =>
      store.addConfirmed(ACTOR, writes),
    ),
  ).rejects.toThrow("Could not save");
  expect(store.getSnapshot()).toEqual([]);
});

it("keeps a confirmed edit until the index returns that exact record version", () => {
  const store = createPendingListenStore(undefined, () => NOW);
  store.addConfirmed(ACTOR, [confirmed()]);
  const older = store.getSnapshot()[0].play;
  const edited = {
    ...confirmed(),
    cid: "bafyedited",
    record: { ...confirmed().record, trackName: "Corrected title" },
  };
  store.addConfirmed(ACTOR, [edited]);
  store.retireIndexed(ACTOR, [older]);
  expect(store.getSnapshot()).toHaveLength(1);
  expect(
    mergePendingListens(ACTOR, [older], store.getSnapshot())[0].trackName,
  ).toBe("Corrected title");
  store.retireIndexed(ACTOR, [{ uri: older.uri }]);
  expect(store.getSnapshot()).toHaveLength(1);
  store.retireIndexed(ACTOR, [{ ...older, cid: edited.cid }]);
  expect(store.getSnapshot()).toEqual([]);
});

it("removes a successfully deleted pending listen only from its owner's cache", async () => {
  const store = createPendingListenStore(undefined, () => NOW);
  store.addConfirmed(ACTOR, [confirmed()]);
  store.addConfirmed(OTHER, [confirmed(OTHER)]);
  store.removeConfirmed(ACTOR, [confirmed(OTHER).uri]);
  expect(store.getSnapshot()).toHaveLength(2);
  store.removeConfirmed(ACTOR, [confirmed().uri]);
  await store.flush();
  expect(store.getSnapshot().map((entry) => entry.play.authorDid)).toEqual([
    OTHER,
  ]);
});

it("persists a confirmed edit that clears its timestamp until matching CID readback", async () => {
  const storage = memoryStorage();
  const before = createPendingListenStore(storage, () => NOW);
  before.addConfirmed(ACTOR, [confirmed()]);
  const older = before.getSnapshot()[0].play;
  const edited = {
    ...confirmed(),
    cid: "bafywithouttime",
    record: { ...confirmed().record, playedTime: undefined },
  };
  before.addConfirmed(ACTOR, [edited]);
  await before.flush();

  const after = createPendingListenStore(storage, () => NOW + 1000);
  await after.hydrate();
  expect(after.getSnapshot()).toHaveLength(1);
  expect(after.getSnapshot()[0].play.playedTime).toBeUndefined();
  after.retireIndexed(ACTOR, [older]);
  const merged = mergePendingListens(ACTOR, [older], after.getSnapshot());
  expect(merged[0].cid).toBe(edited.cid);
  expect(merged[0].playedTime).toBeUndefined();
  const indexed: PlayView = { ...older, cid: edited.cid, playedTime: undefined };
  after.retireIndexed(ACTOR, [indexed]);
  expect(after.getSnapshot()).toEqual([]);
});

it("places timestamp-less confirmed listens after dated rows without inventing a date", () => {
  const store = createPendingListenStore(undefined, () => NOW);
  store.addConfirmed(ACTOR, [
    {
      ...confirmed(ACTOR, "3unknown"),
      record: { ...confirmed().record, playedTime: undefined },
    },
    {
      ...confirmed(ACTOR, "3dated"),
      record: { ...confirmed().record, playedTime: "1965-06-02T12:00:00.000Z" },
    },
    {
      ...confirmed(ACTOR, "3anotherunknown"),
      record: { ...confirmed().record, playedTime: undefined },
    },
  ]);
  const merged = mergePendingListens(ACTOR, [], store.getSnapshot());
  expect(merged.map((play) => play.rkey)).toEqual([
    "3dated",
    "3unknown",
    "3anotherunknown",
  ]);
  expect(merged.slice(1).every((play) => play.playedTime === undefined)).toBe(
    true,
  );
});

it("rejects malformed nonempty timestamps on confirmation and restoration", async () => {
  const storage = memoryStorage();
  const store = createPendingListenStore(storage, () => NOW);
  const malformed = {
    ...confirmed(),
    record: {
      ...confirmed().record,
      playedTime:
        "not-a-timestamp" as ConfirmedListenWrite["record"]["playedTime"],
    },
  };
  store.addConfirmed(ACTOR, [malformed]);
  expect(store.getSnapshot()).toEqual([]);
  store.addConfirmed(ACTOR, [confirmed()]);
  await store.flush();
  for (const [key, raw] of storage.data) {
    const value = JSON.parse(raw);
    value.listens[0].play.playedTime = "not-a-timestamp";
    storage.data.set(key, JSON.stringify(value));
  }
  const reloaded = createPendingListenStore(storage, () => NOW);
  await reloaded.hydrate();
  expect(reloaded.getSnapshot()).toEqual([]);
});
