import { Platform, Share } from "react-native";

/**
 * Shares a link with a line of text. Browsers without the Web Share API get the
 * link copied instead. Resolves to "copied" so callers can say so.
 */
export async function shareLink(message: string, url: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && !navigator.share) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
    await Share.share(Platform.OS === "ios" ? { message, url } : { message: `${message} ${url}`.trim() });
    return "shared";
  } catch {
    return "failed";
  }
}
