import type { ConfirmedListenWrite } from "./pendingListens";
import type { EditablePlayRecord, LoadedPlayRecord } from "./playRecords";

/** Retain each successful edit before proceeding, even if a later write fails. */
export async function updateSelectedPlayRecords(
  rkeys: readonly string[],
  changes: Pick<EditablePlayRecord, "artists" | "releaseName">,
  dependencies: {
    load: (rkey: string) => Promise<LoadedPlayRecord>;
    put: (
      rkey: string,
      record: EditablePlayRecord,
      swapRecord?: string,
    ) => Promise<{ uri: string; cid: string }>;
    confirmed: (write: ConfirmedListenWrite) => void;
  },
) {
  for (const rkey of rkeys) {
    const loaded = await dependencies.load(rkey);
    const record = { ...loaded.record, ...changes };
    const receipt = await dependencies.put(rkey, record, loaded.swapRecord);
    dependencies.confirmed({
      ...receipt,
      // The successful PDS write has validated the complete record we loaded.
      record: record as ConfirmedListenWrite["record"],
    });
  }
}
