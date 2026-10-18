import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import { XrpcError } from "../teal/api";
import { readListenDetail } from "../teal/listenReadback";

const actor = "did:plc:listener";
const rkey = "3newlisten";
const local: PlayView = {
  uri: "at://did:plc:listener/fm.teal.feed.play/3newlisten",
  authorDid: actor,
  cid: "bafyconfirmed",
  trackName: "London Song",
  artists: [{ artistName: "Ninajirachi" }],
  playedTime: "2026-10-17T12:00:00.000Z",
};
const missing = async (): Promise<{ play: PlayView }> => {
  throw new XrpcError("fm.teal.feed.getPlay", 404);
};

it("shows an own confirmed write while the index returns404", async () => {
  await expect(
    readListenDetail(actor, rkey, actor, () => local, missing),
  ).resolves.toEqual({ play: local, syncing: true });
});

it("uses and exposes the actual indexed version after the CID catches up", async () => {
  const indexed = { ...local, author: { displayName: "Teal QA" } };
  await expect(
    readListenDetail(
      actor,
      rkey,
      actor,
      () => local,
      async () => ({ play: indexed }),
    ),
  ).resolves.toEqual({ play: indexed, syncing: false, indexed });
});

it("keeps an edited confirmed version when the index still has the older CID", async () => {
  const indexed = { ...local, cid: "bafyold", trackName: "Old title" };
  const result = await readListenDetail(
    actor,
    rkey,
    actor,
    () => local,
    async () => ({ play: indexed }),
  );
  expect(result).toEqual({ play: local, syncing: true, indexed });
});

it("uses the latest edit receipt when a request begun before the edit finishes late", async () => {
  let confirmed = local;
  let finish: (value: { play: PlayView }) => void = () => {};
  const response = new Promise<{ play: PlayView }>((resolve) => {
    finish = resolve;
  });
  const readback = readListenDetail(
    actor,
    rkey,
    actor,
    () => confirmed,
    () => response,
  );
  confirmed = { ...local, cid: "bafyedited", trackName: "Edited title" };
  finish({ play: local });
  expect((await readback).play).toBe(confirmed);
  expect((await readback).syncing).toBe(true);
});

it.each([undefined, "did:plc:other"])(
  "does not use private local retention for viewer %s",
  async (viewer) => {
    await expect(
      readListenDetail(actor, rkey, viewer, () => local, missing),
    ).rejects.toBeInstanceOf(XrpcError);
  },
);

it("does not use a confirmed receipt for another record", async () => {
  const other: PlayView = {
    ...local,
    uri: "at://did:plc:listener/fm.teal.feed.play/other",
  };
  await expect(
    readListenDetail(actor, rkey, actor, () => other, missing),
  ).rejects.toBeInstanceOf(XrpcError);
});

it.each([401, 500, 503])(
  "keeps an index error%s visible even with a local receipt",
  async (status) => {
    const unavailable = new XrpcError("fm.teal.feed.getPlay", status);
    await expect(
      readListenDetail(
        actor,
        rkey,
        actor,
        () => local,
        async () => {
          throw unavailable;
        },
      ),
    ).rejects.toBe(unavailable);
  },
);
