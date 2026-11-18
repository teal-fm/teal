import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import type { ConfirmedListenWrite } from "./pendingListens";
import { artistsFromText, withEditedIdentity, type EditablePlayRecord, type LoadedPlayRecord } from "./playRecords";

export type BulkPlayChanges = Pick<EditablePlayRecord, "artists" | "releaseName">;

/** The fields a bulk edit changes: only the ones the form filled in. */
export function bulkChangesFromText(artistsText: string, releaseText: string): BulkPlayChanges {
  const changes: BulkPlayChanges = {};
  const artists = artistsText.trim();
  const release = releaseText.trim();

  if (artists) changes.artists = artistsFromText(artists);

  if (release) changes.releaseName = release;

  return changes;
}

/** A play as shown after a bulk edit, until the index catches up. */
export function applyBulkChanges(play: PlayView, changes: BulkPlayChanges): PlayView {
  return { ...play, ...changes };
}

/** Retain each successful edit before proceeding, even if a later write fails. */
export async function updateSelectedPlayRecords(
  rkeys: readonly string[],
  changes: BulkPlayChanges,
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
    const record = withEditedIdentity(loaded.record, changes);
    const receipt = await dependencies.put(rkey, record, loaded.swapRecord);
    dependencies.confirmed({
      ...receipt,
      // SAFETY: the successful PDS write has validated the complete record we loaded.
      record: record as ConfirmedListenWrite["record"],
    });
  }
}
