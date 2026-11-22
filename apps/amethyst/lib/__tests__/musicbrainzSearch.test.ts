import { improvedSearchWithConfig } from "../../../../scripts/eval/search";
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
  expect(lookup.mock.calls).toEqual([
    [track, query.artist, undefined, "exact"],
    [track, undefined, undefined, "exact"],
  ]);

  lookup.mockClear().mockResolvedValue([weak]);
  await improvedSearchWithConfig(track, query.artist, undefined, { ...config, enableMultiStage: false });
  expect(lookup.mock.calls).toEqual([[query.track, query.artist, undefined, "exact"]]);
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
