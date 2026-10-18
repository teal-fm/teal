import { updateSelectedPlayRecords } from "../teal/bulkPlayRecords";
import {
  createPendingListenStore,
  mergePendingListens,
} from "../teal/pendingListens";
import type { EditablePlayRecord } from "../teal/playRecords";

const actor = "did:plc:qa";
const uri = (rkey: string) => `at://${actor}/fm.teal.feed.play/${rkey}`;
const record: EditablePlayRecord = {
  $type: "fm.teal.feed.play",
  trackName: "London Song",
  artists: [{ artistName: "Ninajirachi" }],
  playedTime: "2026-10-17T00:00:00Z",
  releaseName: "Original",
};

it("retains the exact successful bulk-edit CID and keeps it over stale indexed data", async () => {
  const store = createPendingListenStore();
  const put = jest.fn(async (rkey: string) => ({
    uri: uri(rkey),
    cid: "new-cid",
  }));
  await updateSelectedPlayRecords(
    ["one"],
    { releaseName: "Edited" },
    {
      load: async () => ({ record, swapRecord: "old-cid" }),
      put,
      confirmed: (write) => store.addConfirmed(actor, [write]),
    },
  );
  expect(put).toHaveBeenCalledWith(
    "one",
    { ...record, releaseName: "Edited" },
    "old-cid",
  );
  const stale = {
    ...store.getSnapshot()[0].play,
    cid: "old-cid",
    releaseName: "Original",
  };
  expect(
    mergePendingListens(actor, [stale], store.getSnapshot())[0],
  ).toMatchObject({ cid: "new-cid", releaseName: "Edited" });
});

it("keeps completed edits when a later selected record fails, without retaining the failed write", async () => {
  const confirmed = jest.fn();
  await expect(
    updateSelectedPlayRecords(
      ["one", "two", "three"],
      { releaseName: "Edited" },
      {
        load: async () => ({ record }),
        put: async (rkey) => {
          if (rkey === "two") throw new Error("write failed");
          return { uri: uri(rkey), cid: "new-cid" };
        },
        confirmed,
      },
    ),
  ).rejects.toThrow("write failed");
  expect(confirmed).toHaveBeenCalledTimes(1);
  expect(confirmed.mock.calls[0][0]).toMatchObject({
    uri: uri("one"),
    record: { releaseName: "Edited", artists: record.artists },
  });
});
