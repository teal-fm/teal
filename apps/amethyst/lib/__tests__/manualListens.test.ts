import {
  buildListenTimeline,
  buildManualListenRecords,
  createPlayRecordFromRecording,
  effectiveDurationSeconds,
  FALLBACK_DURATION_SECONDS,
  formatDuration,
  normalizeMbid,
  submitManualListenRecords,
  type MusicBrainzAlbumRelease,
  type MusicBrainzAlbumTrack,
} from "../manualListens";

const artist = {
  artist: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Test Artist",
  },
  name: "Test Artist",
};

const release: MusicBrainzAlbumRelease = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Test Album",
  artistCredit: [artist],
};

function track(
  key: string,
  id: string,
  title: string,
  length?: number,
): MusicBrainzAlbumTrack {
  return {
    key,
    number: key,
    length,
    recording: {
      id,
      title,
      length,
      "artist-credit": [artist],
      isrcs: ["US-TEST-00-00001"],
    },
  };
}

describe("manual listen timeline", () => {
  it("uses real durations for a custom start time", () => {
    const first = track("1", "33333333-3333-4333-8333-333333333333", "First", 120000);
    const second = track("2", "44444444-4444-4444-8444-444444444444", "Second", 240000);
    const start = new Date("2026-07-18T12:00:00.000Z");

    const timeline = buildListenTimeline([first, second], "custom", start, start);

    expect(timeline.map((item) => item.playedTime)).toEqual([
      "2026-07-18T12:00:00.000Z",
      "2026-07-18T12:02:00.000Z",
    ]);
  });

  it("backfills earlier tracks from the current newest-track time", () => {
    const first = track("1", "33333333-3333-4333-8333-333333333333", "First", 120000);
    const second = track("2", "44444444-4444-4444-8444-444444444444", "Second", 240000);
    const now = new Date("2026-07-18T12:00:00.000Z");

    const timeline = buildListenTimeline([first, second], "now", undefined, now);

    expect(timeline.map((item) => item.playedTime)).toEqual([
      "2026-07-18T11:58:00.000Z",
      "2026-07-18T12:00:00.000Z",
    ]);
  });

  it("uses the fallback only for timing when duration is missing", () => {
    const missing = track("1", "33333333-3333-4333-8333-333333333333", "Missing");
    const start = new Date("2026-07-18T12:00:00.000Z");

    expect(effectiveDurationSeconds(missing)).toBe(FALLBACK_DURATION_SECONDS);
    expect(buildListenTimeline([missing], "custom", start)[0].playedTime).toBe(
      "2026-07-18T12:00:00.000Z",
    );
    expect(formatDuration(FALLBACK_DURATION_SECONDS)).toBe("3:00");
  });

  it("rejects a custom timeline without a valid start", () => {
    expect(() => buildListenTimeline([track("1", "id", "Track")], "custom")).toThrow(
      "valid starting date",
    );
  });
});

describe("manual listen record mapping", () => {
  it("normalizes MusicBrainz IDs and preserves release metadata", () => {
    const first = track("1", "33333333-3333-4333-8333-333333333333", "First", 120000);
    const records = buildManualListenRecords(
      release,
      [first],
      "custom",
      new Date("2026-07-18T12:00:00.000Z"),
    );

    expect(records[0]).toMatchObject({
      trackName: "First",
      trackMbId: "mbid:33333333-3333-4333-8333-333333333333",
      recordingMbId: "mbid:33333333-3333-4333-8333-333333333333",
      releaseName: "Test Album",
      releaseMbId: "mbid:22222222-2222-4222-8222-222222222222",
      duration: 120,
      isrc: "US-TEST-00-00001",
      musicServiceBaseDomain: "local",
      playedTime: "2026-07-18T12:00:00.000Z",
    });
    expect(records[0].artists).toEqual([
      {
        artistName: "Test Artist",
        artistMbId: "mbid:11111111-1111-4111-8111-111111111111",
      },
    ]);
  });

  it("does not invent a duration when the source has none", () => {
    const recording = {
      id: "33333333-3333-4333-8333-333333333333",
      title: "No Duration",
      "artist-credit": [artist],
      selectedRelease: release,
    };

    expect(createPlayRecordFromRecording(recording).duration).toBeUndefined();
  });

  it("normalizes an already-prefixed MBID without duplicating the prefix", () => {
    expect(normalizeMbid("mbid:33333333-3333-4333-8333-333333333333")).toBe(
      "mbid:33333333-3333-4333-8333-333333333333",
    );
  });
});

describe("atomic repository submission", () => {
  it("sends selected records as one applyWrites transaction", async () => {
    const call = jest.fn(
      async (..._args: [string, unknown, unknown]) => ({
        data: { results: [{ uri: "at://listen/1" }] },
      }),
    );
    const agent = { did: "did:plc:test", call };
    const records = buildManualListenRecords(
      release,
      [track("1", "33333333-3333-4333-8333-333333333333", "First", 120000)],
      "now",
      undefined,
      new Date("2026-07-18T12:00:00.000Z"),
    );

    await expect(submitManualListenRecords(agent, records)).resolves.toBe(1);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][0]).toBe("com.atproto.repo.applyWrites");
    expect(call.mock.calls[0][2]).toMatchObject({
      repo: "did:plc:test",
      writes: [
        {
          $type: "com.atproto.repo.applyWrites#create",
          collection: "fm.teal.alpha.feed.play",
          value: records[0],
        },
      ],
    });
  });

  it("does not submit an empty transaction", async () => {
    const call = jest.fn();
    const agent = {
      did: "did:plc:test",
      call: call as unknown as (method: string, params: Record<string, never>, body: unknown) => Promise<{ data: unknown }>,
    };

    await expect(submitManualListenRecords(agent, [])).rejects.toThrow(
      "Select at least one track",
    );
    expect(call).not.toHaveBeenCalled();
  });
});
