import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type { SongResult } from "@teal/lexicons/src/fm/teal/search/defs";

import { resolveRankedTrack } from "../teal/profileRankedTrack";

const actor = "did:plc:listener";
const recording = "mbid:7bd83145-9219-48f5-b579-0c40d64a71b8";
const otherRecording = "mbid:bbbbbbbb-0000-0000-0000-000000000000";
const listen: PlayView = {
  uri: "at://did:plc:listener/fm.teal.feed.play/old",
  trackName: "London Song",
  releaseName: "Original edition",
  recordingMbId: recording,
  artists: [{ artistName: "Ninajirachi" }],
};
const song: SongResult = {
  uri: "at://did:plc:listener/fm.teal.feed.play/old",
  trackName: "London Song",
  artistName: "Ninajirachi",
  recordingMbId: recording,
  releaseName: "Original edition",
  playCount: 1,
};

it("opens an older exact recording directly from actor-scoped indexed search", async () => {
  const result = await resolveRankedTrack(
    actor,
    recording,
    "London Song",
    undefined,
    {
      search: async (_query, did) =>
        did === actor ? { songs: [song] } : { songs: [] },
      history: async () => {
        throw new Error("History should not be needed");
      },
    },
  );
  expect(result.context?.artist).toBe("Ninajirachi");
  expect(
    new URL(`https://teal.test${result.context?.href}`).searchParams.get("uri"),
  ).toBe(listen.uri);
});

it("paginates beyond the recent50 without substituting a same-title recording", async () => {
  const result = await resolveRankedTrack(
    actor,
    recording,
    "London Song",
    undefined,
    {
      search: async () => ({
        songs: [{ ...song, recordingMbId: otherRecording }],
      }),
      history: async (_actor, _limit, cursor) =>
        cursor === "older"
          ? { plays: [listen] }
          : {
              plays: [{ ...listen, recordingMbId: otherRecording }],
              cursor: "older",
            },
    },
  );
  expect(
    new URL(`https://teal.test${result.context?.href}`).searchParams.get("uri"),
  ).toBe(listen.uri);
});

it("keeps the exact matched edition in the destination", async () => {
  const result = await resolveRankedTrack(
    actor,
    recording,
    "London Song",
    undefined,
    {
      search: async () => ({ songs: [] }),
      history: async () => ({
        plays: [
          {
            ...listen,
            releaseName: "Deluxe edition",
            uri: "at://did:plc:listener/fm.teal.feed.play/deluxe",
          },
        ],
      }),
    },
  );
  expect(result.context?.href).toContain("/deluxe-edition/");
  expect(
    new URL(`https://teal.test${result.context?.href}`).searchParams.get("uri"),
  ).toBe("at://did:plc:listener/fm.teal.feed.play/deluxe");
});

it("bounds a lookup to four history pages and resumes with the next cursor", async () => {
  let pages = 0;
  const deps = {
    search: async () => ({ songs: [] }),
    history: async (_actor: string, _limit: number, cursor?: string) => {
      pages += 1;
      const page = Number(cursor || "0");
      return page === 4
        ? { plays: [listen] }
        : { plays: [], cursor: String(page + 1) };
    },
  };
  const first = await resolveRankedTrack(
    actor,
    recording,
    "London Song",
    undefined,
    deps,
  );
  expect(first).toEqual({ searched: true, cursor: "4" });
  expect(pages).toBe(4);
  const next = await resolveRankedTrack(
    actor,
    recording,
    "London Song",
    first,
    deps,
  );
  expect(next.context?.artist).toBe("Ninajirachi");
  expect(pages).toBe(5);
});

it("does not link records belonging to another actor even when their recording matches", async () => {
  const result = await resolveRankedTrack(
    actor,
    recording,
    "London Song",
    undefined,
    {
      search: async () => ({
        songs: [{ ...song, uri: "at://did:plc:other/fm.teal.feed.play/old" }],
      }),
      history: async () => ({
        plays: [{ ...listen, uri: "at://did:plc:other/fm.teal.feed.play/old" }],
      }),
    },
  );
  expect(result.context).toBeUndefined();
  expect(result.exhausted).toBe(true);
});

it("can use history when indexed search is unavailable", async () => {
  const result = await resolveRankedTrack(
    actor,
    recording,
    "London Song",
    undefined,
    {
      search: async () => {
        throw new Error("Unavailable");
      },
      history: async () => ({ plays: [listen] }),
    },
  );
  expect(result.context?.artist).toBe("Ninajirachi");
});

it("reports a repeated cursor instead of looping over the same page", async () => {
  await expect(
    resolveRankedTrack(
      actor,
      recording,
      "London Song",
      { searched: true, cursor: "stuck" },
      {
        search: async () => ({ songs: [] }),
        history: async () => ({ plays: [], cursor: "stuck" }),
      },
    ),
  ).rejects.toThrow("could not advance");
});

it("stops history work after the requesting row has been left", async () => {
  let current = true;
  let historyCalls = 0;
  const result = await resolveRankedTrack(
    actor,
    recording,
    "London Song",
    undefined,
    {
      search: async () => {
        current = false;
        return { songs: [song] };
      },
      history: async () => {
        historyCalls += 1;
        return { plays: [] };
      },
    },
    () => current,
  );
  expect(result.context).toBeUndefined();
  expect(historyCalls).toBe(0);
});

it("keeps unavailable history distinct from an exhausted history", async () => {
  await expect(
    resolveRankedTrack(actor, recording, "London Song", undefined, {
      search: async () => {
        throw new Error("Search unavailable");
      },
      history: async () => {
        throw new Error("History unavailable");
      },
    }),
  ).rejects.toThrow("History unavailable");
});
