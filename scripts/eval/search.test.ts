import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LastFMCache } from "./evaluate-lastfm-cache.js";
import { compareSearches } from "./search.js";
import { createAPIMetrics } from "./types.js";

test("an unavailable alias leaves healthy responses reusable without scoring a miss", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "teal-search-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const cacheFile = join(directory, "responses.db");
  const config = { enableCleaning: true, enableFuzzy: true, enableMultiStage: true };
  let failAlias = true;

  t.mock.method(globalThis, "fetch", async (input: string) => {
    const url = new URL(input);

    if (url.pathname === "/ws/2/artist") {
      return failAlias
        ? new Response(null, { status: 502 })
        : Response.json({ artists: [{ name: "Example Artist" }] });
    }

    assert.equal(url.pathname, "/ws/2/recording");

    const recordings = url.searchParams.get("query")?.includes("Example Artist")
      ? [{ id: "correct", title: "Example Track", score: 100 }]
      : [{ id: "weak", title: "Wrong track", score: 40 }];

    return Response.json({ recordings });
  });

  async function replay() {
    const cache = new LastFMCache(cacheFile);
    const metrics = createAPIMetrics();

    try {
      const result = await compareSearches("Example Track", "架空歌手", undefined, config, cache, metrics);

      return { result, metrics };
    } finally {
      cache.close();
    }
  }

  const outage = await replay();
  assert.equal(outage.result.status, "unavailable");
  assert.equal(outage.metrics.musicbrainzCalls, 3);
  failAlias = false;
  const recovery = await replay();
  assert.equal(recovery.result.status, "scored");
  assert.equal(recovery.result.baselineCacheHit, true);
  assert.equal(recovery.result.improvedRes[0]?.id, "correct");
  assert.equal(recovery.result.apiCallsImproved, 2);
  assert.equal(recovery.metrics.musicbrainzCalls, 2);
});
