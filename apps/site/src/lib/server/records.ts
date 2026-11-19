import { isObject } from "../records";

const SLINGSHOT = "https://slingshot.microcosm.blue";

/**
 * One record, read through Slingshot's record cache, which the firehose keeps
 * current. Undefined when the record doesn't exist; throws when Slingshot
 * can't say.
 */
export async function getRecord(
  repo: string,
  collection: string,
  rkey: string,
): Promise<Record<string, unknown> | undefined> {
  const query = new URLSearchParams({ repo, collection, rkey });
  const response = await fetch(
    `${SLINGSHOT}/xrpc/com.atproto.repo.getRecord?${query}`,
  );
  if (response.status === 400 || response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Slingshot getRecord: ${response.status}`);
  const body = (await response.json()) as { value?: unknown };

  return isObject(body.value) ? body.value : undefined;
}
