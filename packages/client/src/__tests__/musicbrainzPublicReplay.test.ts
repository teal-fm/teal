import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MusicBrainzRecording, SearchParams } from "../oldStamp";

interface Fixture {
  searchLimit: number;
  cases: Array<{
    name: string;
    input: SearchParams;
    label: number;
    knownMiss?: boolean;
    maxRank?: number;
    requests?: number;
  }>;
  labels: Array<{ recordingId: string }>;
  responses: Array<{ query: string; recordings: MusicBrainzRecording[] }>;
}

// SAFETY: The checked-in fixture uses the versioned case, label and response format above.
const fixture = JSON.parse(readFileSync(
  join(__dirname, "fixtures/musicbrainz-public.json"), "utf8",
)) as Fixture;

const responses = new Map(
  fixture.responses.map(({ query, recordings }) => [query, recordings]),
);

let searchMusicbrainz: typeof import("../searchOrchestrator").searchMusicbrainz;

beforeEach(() => {
  const previousRate = process.env.MB_RATE_LIMIT_MS;
  process.env.MB_RATE_LIMIT_MS = "0";

  try {
    jest.isolateModules(() => {
      ({ searchMusicbrainz } = jest.requireActual<typeof import("../searchOrchestrator")>("../searchOrchestrator"));
    });
  } finally {
    if (previousRate === undefined) delete process.env.MB_RATE_LIMIT_MS;
    else process.env.MB_RATE_LIMIT_MS = previousRate;
  }
});

afterEach(() => jest.restoreAllMocks());

describe("MusicBrainz public recording search replay", () => {
  // The expected recording IDs come from independent MusicBrainz album tracklists.
  it.each(fixture.cases.filter((example) => !example.knownMiss))(
    "$name finds the recording within the expected rank and request count",
    async ({ input, label, maxRank = 1, requests = 1 }) => {
      const missing: string[] = [];

      const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = new URL(String(input));
        const query = url.searchParams.get("query");
        const recordings = query === null ? undefined : responses.get(query);

        if (
          url.origin !== "https://musicbrainz.org" ||
          url.pathname !== "/ws/2/recording" ||
          url.searchParams.get("limit") !== String(fixture.searchLimit) ||
          recordings === undefined
        ) {
          missing.push(url.href);

          return new Response(null, { status: 400 });
        }

        return Response.json({ recordings });
      });

      const results = await searchMusicbrainz(input);
      expect(missing).toEqual([]);
      expect(results.slice(0, maxRank).map(({ id }) => id)).toContain(fixture.labels[label].recordingId);
      expect(fetch).toHaveBeenCalledTimes(requests);
    },
  );

  for (const example of fixture.cases.filter((item) => item.knownMiss)) {
    it.todo(`${example.name} finds the recording on the requested album`);
  }
});

it("tries a CJK artist alias when three exact hits are weak", async () => {
  const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));

    if (url.pathname === "/ws/2/artist") {
      return Response.json({ artists: [{ name: "Example Artist" }] });
    }

    if (url.searchParams.get("query")?.includes('artist:"Example Artist"')) {
      return Response.json({ recordings: [{ id: "desired", title: "Example Song", score: 100 }] });
    }

    return Response.json({
      recordings: Array.from({ length: 3 }, (_, index) => ({
        id: `weak-${index}`, title: `Other Song ${index}`, score: 50,
      })),
    });
  });

  const results = await searchMusicbrainz({ track: "Example Song", artist: "架空歌手" });
  expect(results[0]?.id).toBe("desired");
  expect(fetch.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
    "/ws/2/recording", "/ws/2/artist", "/ws/2/recording",
  ]);
});

it("stops a cancelled request before any follow-up lookup", async () => {
  const controller = new AbortController();

  const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(async (_input, options) => {
    expect(options?.signal).toBe(controller.signal);
    controller.abort();
    throw new Error("Search was cancelled");
  });

  await expect(searchMusicbrainz(
    { track: "Example Song", artist: "架空歌手" },
    { throwOnError: true, signal: controller.signal },
  )).rejects.toThrow("cancelled");
  expect(fetch).toHaveBeenCalledTimes(1);
});
