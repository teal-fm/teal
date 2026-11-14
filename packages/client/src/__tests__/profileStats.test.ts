import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import {
  appendUniqueRecords,
  indexedStatContext,
  isCurrentProfileRequest,
} from "../teal/profileStats";

const listen: PlayView = {
  uri: "at://did:plc:listener/fm.teal.feed.play/1",
  trackName: "London Song",
  releaseName: "I Love My Computer",
  recordingMbId: "mbid:7bd83145-9219-48f5-b579-0c40d64a71b8",
  releaseMbId: "mbid:fc8bf81b-babb-47fe-99fc-841c1abfeb7c",
  artists: [{ artistName: "Ninajirachi" }],
};

it("links a ranked recording to its exact indexed listen and keeps the artist credit", () => {
  const context = indexedStatContext(
    "tracks",
    listen.recordingMbId?.replace("mbid:", ""),
    [listen],
  );
  expect(context?.artist).toBe("Ninajirachi");
  expect(context?.href).toContain(
    "/ninajirachi/i-love-my-computer/london-song?uri=",
  );
  expect(
    new URL(`https://teal.test${context?.href}`).searchParams.get("uri"),
  ).toBe(listen.uri);
});

it("does not borrow context from another recording with the same title", () => {
  expect(
    indexedStatContext("tracks", "mbid:bbbbbbbb-0000-0000-0000-000000000000", [
      listen,
    ]),
  ).toBeUndefined();
  expect(indexedStatContext("tracks", undefined, [listen])).toBeUndefined();
});

it("does not confuse recordings and releases when attaching album context", () => {
  expect(
    indexedStatContext("albums", listen.recordingMbId, [listen]),
  ).toBeUndefined();
  expect(
    indexedStatContext("albums", listen.releaseMbId, [listen])?.artist,
  ).toBe("Ninajirachi");
});

it("keeps one copy of each live record when cursor pages overlap", () => {
  const second: PlayView = {
    ...listen,
    uri: "at://did:plc:listener/fm.teal.feed.play/2",
  };
  expect(appendUniqueRecords([listen], [listen, second, second])).toEqual([
    listen,
    second,
  ]);
});

it("retains identity-less records rather than guessing that equal titles are duplicates", () => {
  const withoutUri = { ...listen, uri: undefined };
  expect(appendUniqueRecords([], [withoutUri, withoutUri])).toEqual([
    withoutUri,
    withoutUri,
  ]);
});

it("accepts a follow completion only while the subject and signed-in viewer are unchanged", () => {
  const started = {
    generation: 1,
    actor: "listener.test",
    targetDid: "did:plc:listener",
    viewerDid: "did:plc:viewer",
  };
  expect(isCurrentProfileRequest(started, { ...started })).toBe(true);
  expect(
    isCurrentProfileRequest(started, {
      ...started,
      targetDid: "did:plc:other",
    }),
  ).toBe(false);
  expect(
    isCurrentProfileRequest(started, {
      ...started,
      viewerDid: "did:plc:another-viewer",
    }),
  ).toBe(false);
});

it("rejects an earlier follow completion after navigating away and back to the same profile", () => {
  const started = {
    generation: 1,
    actor: "listener.test",
    targetDid: "did:plc:listener",
    viewerDid: "did:plc:viewer",
  };
  expect(isCurrentProfileRequest(started, { ...started, generation: 2 })).toBe(
    false,
  );
  // During a route transition the old DID may still be rendered; the new actor also invalidates it.
  expect(
    isCurrentProfileRequest(started, { ...started, actor: "other.test" }),
  ).toBe(false);
});
