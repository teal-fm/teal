import { baselineSearch, compareSearches, improvedSearchWithConfig } from "../../../../scripts/eval/search";
import { createAPIMetrics } from "../../../../scripts/eval/types";
import { searchMusicbrainz } from "../searchOrchestrator";
import * as musicbrainz from "../musicbrainzSearchUtils";

const query = { track: "Moonrise", artist: "Evening Ensemble" };
const correct = {
  id: "correct",
  title: query.track,
  "artist-credit": [{ name: query.artist, artist: { id: "ensemble", name: query.artist } }],
  score: 100,
};
const weak = { id: "weak", title: "Unrelated song", score: 10 };
const config = { enableCleaning: true, enableFuzzy: true, enableMultiStage: true };

afterEach(() => jest.restoreAllMocks());

describe.each([
  ["app", () => searchMusicbrainz(query)],
  ["evaluator", () => improvedSearchWithConfig(query.track, query.artist, undefined, config)],
] as const)("%s recording search", (_name, search) => {
  it("recovers a better match after a weak exact hit", async () => {
    const lookup = jest.spyOn(musicbrainz, "searchStage").mockImplementation(
      async (_track, artist, _release, strategy) => {
        if (strategy === "fuzzy") return [correct];
        return artist ? [weak] : [];
      },
    );

    expect((await search()).map((r) => r.id)).toEqual(["correct", "weak"]);
    expect(lookup.mock.calls.map(([, artist, , strategy]) => [artist, strategy])).toEqual([
      [query.artist, "exact"],
      [query.artist, "fuzzy"],
      [undefined, "exact"],
    ]);
  });

  it("keeps looking when all three exact candidates are weak", async () => {
    const weakCandidates = [10, 12, 15].map((score) => ({
      ...weak,
      id: String(score),
      score,
    }));
    const lookup = jest.spyOn(musicbrainz, "searchStage").mockImplementation(
      async (_track, artist, _release, strategy) => {
        if (strategy === "fuzzy") return [correct];
        return artist ? weakCandidates : [];
      },
    );

    expect((await search())[0]).toEqual(correct);
    expect(lookup.mock.calls[1][3]).toBe("fuzzy");
  });

  it("returns a strong exact hit without spending another lookup", async () => {
    const lookup = jest.spyOn(musicbrainz, "searchStage").mockResolvedValue([correct]);

    expect(await search()).toEqual([correct]);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});

it("stops when the second exact lookup returns a strong match", async () => {
  const lookup = jest.spyOn(musicbrainz, "searchStage")
    .mockResolvedValueOnce([weak])
    .mockResolvedValueOnce([correct]);

  expect((await searchMusicbrainz({ ...query, release: "EP" }))[0]).toEqual(correct);
  expect(lookup).toHaveBeenCalledTimes(2);
});

it("counts distinct recordings when deciding whether to keep searching", async () => {
  const anotherWeak = { ...weak, id: "other" };
  const lookup = jest.spyOn(musicbrainz, "searchStage")
    .mockResolvedValueOnce([weak, anotherWeak])
    .mockResolvedValueOnce([weak, anotherWeak])
    .mockResolvedValueOnce([correct])
    .mockResolvedValueOnce([]);

  expect((await searchMusicbrainz({ ...query, release: "EP" }))[0]).toEqual(correct);
  expect(lookup.mock.calls.map(([, , , strategy]) => strategy)).toContain("fuzzy");
});

it("treats a recording without a relevance score as unconfirmed", async () => {
  const lookup = jest.spyOn(musicbrainz, "searchStage")
    .mockResolvedValueOnce([{ id: weak.id, title: weak.title }])
    .mockResolvedValueOnce([correct])
    .mockResolvedValueOnce([]);

  expect((await searchMusicbrainz(query))[0]).toEqual(correct);
  expect(lookup.mock.calls[1][3]).toBe("fuzzy");
});

it("reuses cached stage responses for the evaluation", async () => {
  const network = jest.spyOn(musicbrainz, "searchStage").mockResolvedValue([]);
  const cache = {
    getSearchResults: jest.fn()
      .mockReturnValueOnce([weak])
      .mockReturnValueOnce([correct])
      .mockReturnValueOnce([]),
    setSearchResults: jest.fn(),
  };

  const results = await improvedSearchWithConfig(query.track, query.artist, undefined, config, cache);
  expect(results.map((r) => r.id)).toEqual(["correct", "weak"]);
  expect(network).not.toHaveBeenCalled();
  expect(cache.setSearchResults).not.toHaveBeenCalled();
});

it("honors the evaluation switches for cleaning, fuzzy search, and all fallbacks", async () => {
  const lookup = jest.spyOn(musicbrainz, "searchStage").mockResolvedValue([]);
  const track = "Moonrise (Remastered)";
  await improvedSearchWithConfig(track, query.artist, undefined, {
    ...config, enableCleaning: false, enableFuzzy: false,
  });
  expect(lookup.mock.calls.map((call) => call.slice(0, 4))).toEqual([
    [track, query.artist, undefined, "exact"],
    [track, undefined, undefined, "exact"],
  ]);

  lookup.mockClear().mockResolvedValue([weak]);
  await improvedSearchWithConfig(track, query.artist, undefined, { ...config, enableMultiStage: false });
  expect(lookup.mock.calls.map((call) => call.slice(0, 4))).toEqual([[query.track, query.artist, undefined, "exact"]]);
});

it("keeps looking for the requested edition after a fuzzy title and artist match", async () => {
  const release = "Original Album";
  const studio = { ...correct, releases: [{ id: "original", title: release }] };
  const live = { ...correct, id: "live", releases: [{ id: "live-album", title: "Live Album" }] };
  const lookup = jest.spyOn(musicbrainz, "searchStage")
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([live])
    .mockResolvedValueOnce([studio]);

  expect((await searchMusicbrainz({ ...query, release }))[0]?.id).toBe(studio.id);
  expect(lookup).toHaveBeenCalledTimes(4);
});

it("stops before the next lookup when an interactive search is canceled", async () => {
  const controller = new AbortController();
  const onFallback = jest.fn();
  const lookup = jest.spyOn(musicbrainz, "searchStage").mockImplementationOnce(async () => {
    controller.abort();
    return [weak];
  });

  expect(await searchMusicbrainz(query, { signal: controller.signal, onFallback })).toEqual([]);
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(onFallback).not.toHaveBeenCalled();
});

it("does not retry an interactive MusicBrainz request after cancellation", async () => {
  jest.useFakeTimers();
  try {
    const controller = new AbortController();
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
    const pending = searchMusicbrainz(query, { signal: controller.signal });

    await jest.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]?.signal).toBe(controller.signal);
    controller.abort();
    await jest.runAllTimersAsync();

    expect(await pending).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it.each(["baseline", "candidate"])("keeps a %s outage out of the cache", async (arm) => {
  jest.useFakeTimers();
  try {
    const cache = { getSearchResults: jest.fn().mockReturnValue(null), setSearchResults: jest.fn() };
    const track = `Recovery ${arm}`;
    const run = () => arm === "baseline"
      ? baselineSearch(track, query.artist, undefined, cache)
      : improvedSearchWithConfig(track, query.artist, undefined, config, cache);
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 502 }));

    const outage = expect(run()).rejects.toThrow("HTTP 502");
    await jest.runAllTimersAsync();
    await outage;
    expect(cache.setSearchResults).not.toHaveBeenCalled();

    fetch.mockResolvedValueOnce(Response.json({ recordings: [correct] }));
    const healthy = run();
    await jest.runAllTimersAsync();
    expect(await healthy).toEqual([correct]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(cache.setSearchResults).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it("counts alias requests per pair even when comparisons overlap", async () => {
  jest.useFakeTimers();
  try {
    const metrics = createAPIMetrics();
    const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/artist")) return Response.json({ artists: [{ name: "Ryuichi Sakamoto" }] });
      const search = url.searchParams.get("query") ?? "";
      return Response.json({ recordings: search.includes("坂本龍一") ? [] : [correct] });
    });
    const results = Promise.all([
      compareSearches("Alias experiment", "坂本龍一", undefined, config, undefined, metrics),
      compareSearches("Plain experiment", query.artist, undefined, config, undefined, metrics),
    ]);
    await jest.runAllTimersAsync();
    expect(await results).toMatchObject([
      { status: "scored", apiCallsImproved: 3 },
      { status: "scored", apiCallsImproved: 1 },
    ]);
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(metrics.musicbrainzCalls).toBe(6);
  } finally {
    jest.useRealTimers();
  }
});

it("excludes an unavailable alias lookup and accepts a healthy empty response", async () => {
  jest.useFakeTimers();
  try {
    let artistUnavailable = true;
    const cache = { getSearchResults: jest.fn().mockReturnValue(null), setSearchResults: jest.fn() };
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (new URL(String(input)).pathname.endsWith("/artist")) {
        if (artistUnavailable) return new Response(null, { status: 502 });
        return Response.json({ artists: [] });
      }
      return Response.json({ recordings: [] });
    });
    const run = () => compareSearches("Alias outage", "久石譲", undefined, config, cache);
    const outage = run();
    await jest.runAllTimersAsync();
    expect(await outage).toMatchObject({ status: "unavailable" });

    artistUnavailable = false;
    const healthy = run();
    await jest.runAllTimersAsync();
    expect(await healthy).toMatchObject({ status: "scored", baselineRes: [], improvedRes: [] });
  } finally {
    jest.useRealTimers();
  }
});
