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
  }>;
  labels: Array<{ recordingId: string }>;
  responses: Array<{ query: string; recordings: MusicBrainzRecording[] }>;
}

const fixture = JSON.parse(readFileSync(
  join(__dirname, "fixtures/musicbrainz-public.json"), "utf8",
)) as Fixture;

const responses = new Map(
  fixture.responses.map(({ query, recordings }) => [query, recordings]),
);

let searchMusicbrainz: typeof import("../searchOrchestrator").searchMusicbrainz;
beforeAll(async () => {
  const previousRate = process.env.MB_RATE_LIMIT_MS;
  process.env.MB_RATE_LIMIT_MS = "0";
  try {
    ({ searchMusicbrainz } = await import("../searchOrchestrator"));
  } finally {
    if (previousRate === undefined) delete process.env.MB_RATE_LIMIT_MS;
    else process.env.MB_RATE_LIMIT_MS = previousRate;
  }
});

afterEach(() => jest.restoreAllMocks());

describe("MusicBrainz public recording search replay", () => {
  // The expected recording IDs come from independent MusicBrainz album tracklists.
  it.each(fixture.cases.filter((example) => !example.knownMiss))(
    "$name ranks the requested recording first using one request",
    async ({ input, label }) => {
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
      expect(results[0]?.id).toBe(fixture.labels[label].recordingId);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  for (const example of fixture.cases.filter((item) => item.knownMiss)) {
    it.todo(`${example.name} finds the recording on the requested album`);
  }
});
