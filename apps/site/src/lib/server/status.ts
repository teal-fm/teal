import { newest, STATUS_COLLECTIONS, statusOf, type NowPlaying } from "../status";

const SLINGSHOT = "https://slingshot.microcosm.blue";

/**
 * What someone is playing right now, read through Slingshot's record cache,
 * which the firehose keeps current. Undefined when nothing is playing or the
 * lookup fails; the page's own Jetstream subscription fills in after that.
 */
export async function getNowPlaying(
  did: string,
): Promise<NowPlaying | undefined> {
  const statuses = await Promise.all(
    STATUS_COLLECTIONS.map(async (collection) => {
      const query = new URLSearchParams({ repo: did, collection, rkey: "self" });
      const response = await fetch(
        `${SLINGSHOT}/xrpc/com.atproto.repo.getRecord?${query}`,
      ).catch(() => undefined);
      if (!response?.ok) return undefined;
      const body = (await response.json().catch(() => undefined)) as
        | { value?: unknown }
        | undefined;

      return statusOf(collection, body?.value);
    }),
  );

  return newest(statuses);
}
