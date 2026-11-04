import { searchMusicbrainz } from "../searchOrchestrator";

afterEach(() => jest.restoreAllMocks());

it("reports a MusicBrainz outage instead of an empty result when asked", async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(global, "fetch").mockResolvedValue(new Response("down", { status: 500 }));
  await expect(searchMusicbrainz({ track: "Outage Song" }, { throwOnError: true })).rejects.toThrow(/MusicBrainz/);
  await expect(searchMusicbrainz({ track: "Outage Song Two" })).resolves.toEqual([]);
}, 30_000);
