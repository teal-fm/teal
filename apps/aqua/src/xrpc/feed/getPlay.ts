import { TealContext } from "@/ctx";
import { db, tealSession, play } from "@teal/db";
import { eq, and } from "drizzle-orm";
import { OutputSchema } from "@teal/lexicons/src/types/fm/teal/alpha/feed/getPlay";

export default async function getPlay(c: TealContext) {
  // do we have required query params?
  const params = c.req.query();
  if (params.authorDid === undefined) {
    throw new Error("authorDid is required");
  }
  if (!params.rkey) {
    throw new Error("rkey is required");
  }

  let res = await db
    .select()
    .from(play)
    .where(
      and(eq(play.authorDid, params.authorDid), and(eq(play.uri, params.rkey))),
    )
    .execute();

  if (res.length === 0) {
    throw new Error("Play not found");
  }
  res[0];

  // return a PlayView
  return {
    play: {
      uri: res[0].uri,
      authorDid: res[0].authorDid,
      createdAt: res[0].createdAt,
      indexedAt: res[0].indexedAt,
      trackName: res[0].trackName,
      trackMbId: res[0].trackMbId,
      recordingMbId: res[0].recordingMbId,
      duration: res[0].duration,
      artistNames: res[0].artistNames,
      artistMbIds: res[0].artistMbIds,
      releaseName: res[0].releaseName,
      releaseMbId: res[0].releaseMbId,
      isrc: res[0].isrc,
      originUrl: res[0].originUrl,
      musicServiceBaseDomain: res[0].musicServiceBaseDomain,
      submissionClientAgent: res[0].submissionClientAgent,
      playedTime: res[0].playedTime,
    },
  } as OutputSchema;
}
