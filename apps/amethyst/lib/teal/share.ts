import { Share } from "react-native";

/** Shares a link with a line of text through the system share sheet. */
export async function shareLink(message: string, url: string): Promise<"shared" | "failed"> {
  try {
    // Android's share sheet has no separate URL field, so the link goes in the message.
    await Share.share({ message: `${message} ${url}`.trim() });

    return "shared";
  } catch {
    return "failed";
  }
}
