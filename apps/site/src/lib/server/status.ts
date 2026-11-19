import {
  newest,
  STATUS_COLLECTIONS,
  statusOf,
  type NowPlaying,
} from "../status";
import { getRecord } from "./records";

/**
 * What someone is playing right now. Undefined when nothing is playing or the
 * lookup fails; the page's own Jetstream subscription fills in after that.
 */
export async function getNowPlaying(
  did: string,
): Promise<NowPlaying | undefined> {
  const statuses = await Promise.all(
    STATUS_COLLECTIONS.map(async (collection) =>
      statusOf(
        collection,
        await getRecord(did, collection, "self").catch(() => undefined),
      ),
    ),
  );

  return newest(statuses);
}
