import { getReleaseGroupCoverArtUrl } from "../teal/api";

const groupMbid = "15c3b397-9652-4537-a14b-7eb8489092ff";

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("shares Aqua metadata across card image sizes", async () => {
  const fetch = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ releaseGroupMbid: `mbid:${groupMbid}` })),
    );
  const releaseMbid = "a5e766b8-650c-40ce-a19f-3dc3c865a3e2";
  const [small, large] = await Promise.all([
    getReleaseGroupCoverArtUrl(`mbid:${releaseMbid}`, 250),
    getReleaseGroupCoverArtUrl(releaseMbid, 500),
  ]);
  expect(small).toBe(
    `https://coverartarchive.org/release-group/${groupMbid}/front-250`,
  );
  expect(large).toBe(
    `https://coverartarchive.org/release-group/${groupMbid}/front-500`,
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  const url = new URL(fetch.mock.calls[0][0] as string);
  expect(url.pathname).toBe("/xrpc/fm.teal.music.getReleaseGroup");
  expect(url.searchParams.get("mbid")).toBe(`mbid:${releaseMbid}`);
});

it("retries a transient Aqua failure after the cooldown", async () => {
  jest.useFakeTimers();
  const releaseMbid = "260b6184-8828-48eb-945c-bc4cb6fc34ca";
  const fetch = jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ releaseGroupMbid: `mbid:${groupMbid}` })),
    );
  await expect(
    getReleaseGroupCoverArtUrl(releaseMbid),
  ).resolves.toBeUndefined();
  await expect(
    getReleaseGroupCoverArtUrl(releaseMbid),
  ).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(30_001);
  await expect(getReleaseGroupCoverArtUrl(releaseMbid)).resolves.toContain(
    groupMbid,
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("caches a successful lookup with no release group", async () => {
  const fetch = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response("{}"));
  const releaseMbid = "1be5c516-22ec-48e0-9b45-dc6837ad6f03";
  await expect(
    getReleaseGroupCoverArtUrl(releaseMbid),
  ).resolves.toBeUndefined();
  await expect(
    getReleaseGroupCoverArtUrl(releaseMbid),
  ).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("keeps known cover art when an expired lookup cannot refresh", async () => {
  jest.useFakeTimers();
  const releaseMbid = "bdc9b9a1-8d7b-40c7-81ca-20d23dc40133";
  const fetch = jest
    .spyOn(global, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ releaseGroupMbid: `mbid:${groupMbid}` })),
    )
    .mockResolvedValueOnce(new Response("", { status: 503 }));
  const knownCover = await getReleaseGroupCoverArtUrl(releaseMbid);
  jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
  await expect(getReleaseGroupCoverArtUrl(releaseMbid)).resolves.toBe(
    knownCover,
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});
