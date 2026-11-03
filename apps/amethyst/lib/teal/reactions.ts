import type { Agent } from "@atproto/api";

import type { ReactionSummary } from "./api";
import { rkeyFromAtUri } from "./routes";

/** The quick reactions shown everywhere; "+" opens any emoji. */
export const QUICK_REACTIONS = ["🔥", "😭", "🫶", "🔁", "🤯"] as const;

export type ReactionSubject = { uri: string; cid?: string };

const COLLECTION = "fm.teal.feed.social.reaction";

/** Writes one emoji reaction to the viewer's repo and returns its record URI. */
export async function addReaction(
  agent: Agent,
  subject: ReactionSubject,
  emoji: string,
): Promise<string> {
  if (!agent.did) throw new Error("Sign in to react.");
  if (!subject.cid) throw new Error("This item can't be reacted to yet.");
  const res = await agent.call(
    "com.atproto.repo.createRecord",
    {},
    {
      repo: agent.did,
      collection: COLLECTION,
      record: {
        $type: COLLECTION,
        subject: { uri: subject.uri, cid: subject.cid },
        emoji,
        createdAt: new Date().toISOString(),
      },
    },
  );
  return (res.data as { uri: string }).uri;
}

export async function removeReaction(agent: Agent, reactionUri: string) {
  if (!agent.did) throw new Error("Sign in to react.");
  await agent.call(
    "com.atproto.repo.deleteRecord",
    {},
    { repo: agent.did, collection: COLLECTION, rkey: rkeyFromAtUri(reactionUri)! },
  );
}

/**
 * Returns summaries with the viewer's reaction for `emoji` set to `viewerReaction`
 * (added) or removed (undefined), keeping counts and order consistent.
 */
export function withViewerReaction(
  summaries: ReactionSummary[] = [],
  emoji: string,
  viewerReaction: string | undefined,
): ReactionSummary[] {
  const existing = summaries.find((s) => s.emoji === emoji);
  if (!existing) {
    return viewerReaction
      ? [...summaries, { emoji, count: 1, viewerReaction }]
      : summaries;
  }
  const had = !!existing.viewerReaction;
  const has = !!viewerReaction;
  const count = existing.count + (has === had ? 0 : has ? 1 : -1);
  return summaries
    .map((s) => (s.emoji === emoji ? { ...s, count, viewerReaction } : s))
    .filter((s) => s.count > 0);
}
