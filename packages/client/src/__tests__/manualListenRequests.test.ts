import { searchMusicBrainzReleases } from "../manualListens";

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("times out a stalled lookup and lets the next lookup use the queue", async () => {
  jest.useFakeTimers();
  const fetch = jest.spyOn(global, "fetch").mockImplementationOnce(
    (_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }),
  );
  let failure: unknown;
  const stalled = searchMusicBrainzReleases("Discovery", "Daft Punk")
    .catch((error: unknown) => { failure = error; });

  await jest.advanceTimersByTimeAsync(20_000);
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toMatch(/timed out/i);
  await stalled;

  fetch.mockResolvedValueOnce(new Response(JSON.stringify({ releases: [] })));
  await expect(searchMusicBrainzReleases("Discovery", "Daft Punk")).resolves.toEqual([]);
  expect(jest.getTimerCount()).toBe(0);
});
