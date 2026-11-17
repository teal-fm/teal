import { z } from "zod";

const recordNotFoundSchema = z.object({ error: z.literal("RecordNotFound") });

/** Whether a com.atproto.repo.getRecord call failed because the record doesn't exist. */
export function isRecordNotFound(
  error: unknown,
): error is z.infer<typeof recordNotFoundSchema> {
  return recordNotFoundSchema.safeParse(error).success;
}

/** Only a confirmed missing account record should begin first-use setup. */
export async function firstLoginHref(
  did: string,
  readProfile: () => Promise<object>,
  timeoutMs = 4_000,
): Promise<string> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      readProfile(),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Profile lookup timed out")),
          timeoutMs,
        );
      }),
    ]);

    return "/";
  } catch (error) {
    return isRecordNotFound(error)
      ? "/onboarding"
      : `/profile/${encodeURIComponent(did)}`;
  } finally {
    clearTimeout(timeout);
  }
}
