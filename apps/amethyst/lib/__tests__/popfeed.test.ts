import {
  createPopfeedListRecord,
  popfeedItemsFromPlay,
  POPFEED_LIST_COLLECTION,
  POPFEED_LIST_ITEM_COLLECTION,
  syncPlayToPopfeed,
  TEAL_POPFEED_LIST_NAME,
} from "../popfeed";

import type { Record as PlayRecord } from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";

describe("Popfeed sync mapping", () => {
  const play: PlayRecord = {
    trackName: "Age of Consent",
    recordingMbId: "mbid:recording-1",
    releaseName: "Power, Corruption & Lies",
    releaseMbId: "mbid:release-1",
    artists: [{ artistName: "New Order", artistMbId: "artist-1" }],
    playedTime: "1983-05-02T12:00:00.000Z",
  };

  it("creates a Teal Popfeed list record", () => {
    const record = createPopfeedListRecord(
      new Date("2026-06-15T00:00:00.000Z"),
    );

    expect(record).toEqual({
      $type: POPFEED_LIST_COLLECTION,
      name: TEAL_POPFEED_LIST_NAME,
      description: "Music first heard through Teal.",
      listType: "default",
      ordered: false,
      itemOrder: [],
      createdAt: "2026-06-15T00:00:00.000Z",
    });
  });

  it("maps a played track to Popfeed track and album items", () => {
    const items = popfeedItemsFromPlay({
      play,
      releaseDate: "1983-05-02",
      releaseGroupType: "Album",
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      $type: POPFEED_LIST_ITEM_COLLECTION,
      addedAt: "1983-05-02T12:00:00.000Z",
      creativeWorkType: "track",
      identifiers: {
        mbReleaseId: "recording-1",
        parentMbReleaseId: "release-1",
      },
      listType: "default",
      mainCredit: "New Order",
      mainCreditRole: "artist",
      releaseDate: "1983-05-02T00:00:00.000Z",
      title: "Age of Consent",
    });
    expect(items[1]).toMatchObject({
      $type: POPFEED_LIST_ITEM_COLLECTION,
      creativeWorkType: "album",
      identifiers: {
        mbId: "release-1",
        mbReleaseId: "release-1",
      },
      title: "Power, Corruption & Lies",
    });
  });

  it("uses the EP creative work type for EP release groups", () => {
    const items = popfeedItemsFromPlay({
      play,
      releaseGroupType: "EP",
    });

    expect(items[1].creativeWorkType).toBe("ep");
  });

  it("creates missing list items and skips duplicates", async () => {
    const created: Record<string, unknown>[] = [];
    const fakeAgent = {
      did: "did:plc:viewer",
      call: jest.fn(
        async (
          method: string,
          params?: Record<string, unknown>,
          data?: Record<string, unknown>,
        ) => {
          if (method === "com.atproto.repo.listRecords") {
            if (params?.collection === POPFEED_LIST_COLLECTION) {
              return {
                data: {
                  records: [
                    {
                      uri: "at://did:plc:viewer/social.popfeed.feed.list/abc",
                      value: createPopfeedListRecord(),
                    },
                  ],
                },
              };
            }
            if (params?.collection === POPFEED_LIST_ITEM_COLLECTION) {
              return {
                data: {
                  records: [
                    {
                      uri: "at://did:plc:viewer/social.popfeed.feed.listItem/track",
                      value: {
                        $type: POPFEED_LIST_ITEM_COLLECTION,
                        addedAt: play.playedTime,
                        creativeWorkType: "track",
                        identifiers: { mbReleaseId: "recording-1" },
                        listUri:
                          "at://did:plc:viewer/social.popfeed.feed.list/abc",
                      },
                    },
                  ],
                },
              };
            }
          }

          if (method === "com.atproto.repo.createRecord") {
            created.push(data?.record as Record<string, unknown>);
            return {
              data: {
                uri: `at://did:plc:viewer/${data?.collection as string}/created`,
              },
            };
          }

          throw new Error(`Unexpected method ${method}`);
        },
      ),
    };

    const result = await syncPlayToPopfeed(fakeAgent, { play });

    expect(result).toEqual({
      created: 1,
      skipped: 1,
      listUri: "at://did:plc:viewer/social.popfeed.feed.list/abc",
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      $type: POPFEED_LIST_ITEM_COLLECTION,
      creativeWorkType: "album",
      identifiers: {
        mbId: "release-1",
        mbReleaseId: "release-1",
      },
      listUri: "at://did:plc:viewer/social.popfeed.feed.list/abc",
    });
  });
});
