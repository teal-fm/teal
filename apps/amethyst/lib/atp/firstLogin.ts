export function isMissingProfileRecord(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    error.error === "RecordNotFound"
  );
}

/** Only a confirmed missing account record should begin first-use setup. */
export async function firstLoginHref(
  did: string,
  readProfile: () => Promise<unknown>,
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
    return isMissingProfileRecord(error)
      ? "/onboarding"
      : `/profile/${encodeURIComponent(did)}`;
  } finally {
    clearTimeout(timeout);
  }
}
