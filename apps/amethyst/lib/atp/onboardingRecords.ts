export const STABLE_PROFILE_COLLECTION = "fm.teal.actor.profile";
export const LEGACY_PROFILE_COLLECTION = "fm.teal.alpha.actor.profile";
export const STABLE_PROFILE_STATUS_COLLECTION = "fm.teal.actor.profileStatus";
export const LEGACY_PROFILE_STATUS_COLLECTION =
  "fm.teal.alpha.actor.profileStatus";

export interface RepoRecordAgent {
  call: (
    methodNsid: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: { cid?: string; value: unknown } }>;
  did?: string;
}

export interface RepoRecord<T> {
  collection: string;
  cid?: string;
  record: T;
}

/**
 * Read a self record from the stable namespace, falling back to the old
 * namespace for users whose repositories have not been migrated yet.
 */
export async function readRepoRecordWithLegacyFallback<T>(
  agent: RepoRecordAgent,
  stableCollection: string,
  legacyCollection: string,
): Promise<RepoRecord<T> | null> {
  try {
    return await readRepoRecord<T>(agent, stableCollection);
  } catch (stableError) {
    try {
      return await readRepoRecord<T>(agent, legacyCollection);
    } catch (legacyError) {
      if (isRecordNotFound(stableError) || isRecordNotFound(legacyError)) {
        return null;
      }

      throw stableError;
    }
  }
}

function readRepoRecord<T>(
  agent: RepoRecordAgent,
  collection: string,
): Promise<RepoRecord<T>> {
  return agent
    .call("com.atproto.repo.getRecord", {
      repo: agent.did,
      collection,
      rkey: "self",
    })
    .then((response) => ({
      collection,
      cid: response.data.cid,
      record: response.data.value as T,
    }));
}

function isRecordNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const details = error as { error?: unknown; message?: unknown };
  const errorCode = typeof details.error === "string" ? details.error : "";
  const message = typeof details.message === "string" ? details.message : "";

  return (
    errorCode === "RecordNotFound" ||
    /(?:record(?:.*)?(?:not found|does not exist)|(?:not found|does not exist).*record|could not find record)/i.test(
      message,
    )
  );
}

export function getBlobHash(blob: unknown): string | undefined {
  if (typeof blob === "string") return blob;
  if (!blob || typeof blob !== "object") return undefined;

  const ref = (blob as { ref?: unknown }).ref;
  if (typeof ref === "string") return ref;
  if (ref && typeof ref === "object") {
    const link = (ref as { $link?: unknown }).$link;
    if (typeof link === "string") return link;

    const stringified = String(ref);
    if (stringified !== "[object Object]") return stringified;
  }

  return undefined;
}
