/**
 * Shares a link with a line of text. Browsers without the Web Share API get the
 * link copied instead. Resolves to "copied" so callers can say so.
 */
export async function shareLink(message: string, url: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (!navigator.share) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
    await navigator.share({ text: message, url });
    return "shared";
  } catch (error) {
    // Dismissing the share sheet isn't a failure worth reporting.
    if (error instanceof DOMException && error.name === "AbortError") return "shared";
    return "failed";
  }
}
