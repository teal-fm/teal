import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import { XrpcError } from "./api";

/** A local fallback is only a confirmed write belonging to this signed-in actor and exact record. */
export async function readListenDetail(
  authorDid: string,
  rkey: string,
  viewerDid: string | undefined,
  confirmed: () => PlayView | undefined,
  fetchIndexed: (did: string, rkey: string) => Promise<{ play: PlayView }>,
): Promise<{ play: PlayView; syncing: boolean; indexed?: PlayView }> {
  const uri = `at://${authorDid}/fm.teal.feed.play/${rkey}`;
  function ownConfirmed() {
    const play = confirmed();
    return viewerDid === authorDid &&
      play?.authorDid === viewerDid &&
      play.uri === uri &&
      play.cid
      ? play
      : undefined;
  }
  try {
    const { play: indexed } = await fetchIndexed(authorDid, rkey);
    const local = ownConfirmed();
    return local && local.cid !== indexed.cid
      ? { play: local, syncing: true, indexed }
      : { play: indexed, syncing: false, indexed };
  } catch (error) {
    const local = ownConfirmed();
    if (error instanceof XrpcError && error.status === 404 && local)
      return { play: local, syncing: true };
    throw error;
  }
}
