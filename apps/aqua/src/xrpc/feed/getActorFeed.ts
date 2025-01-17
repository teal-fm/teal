import { TealContext } from "@/ctx";
import { db, tealSession, play } from "@teal/db";
import { eq, and, lt } from "drizzle-orm";
import { OutputSchema } from "@teal/lexicons/src/types/fm/teal/alpha/feed/getActorFeed";
import { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

export default async function getActorFeed(c: TealContext) {
  const params = c.req.query();
  if (!params.authorDid) {
    throw new Error("authorDid is required");
  }

  // 'and' is here for typing reasons
  let whereClause = and(eq(play.authorDid, params.authorDid));

  // Add cursor pagination if provided
  if (params.cursor) {
    const [cursorPlay] = await db
      .select({ createdAt: play.createdAt })
      .from(play)
      .where(eq(play.uri, params.cursor))
      .limit(1);

    if (!cursorPlay) {
      throw new Error("Cursor not found");
    }

    whereClause = and(whereClause, lt(play.createdAt, cursorPlay.createdAt));
  }

  const plays = await db
    .select()
    .from(play)
    .where(whereClause)
    .orderBy(play.createdAt)
    .limit(10);

  if (plays.length === 0) {
    throw new Error("Play not found");
  }

  return {
    plays: plays.map(
      ({
        uri,
        authorDid,
        createdAt,
        indexedAt,
        trackName,
        trackMbId,
        recordingMbId,
        duration,
        artistNames,
        artistMbIds,
        releaseName,
        releaseMbId,
        isrc,
        originUrl,
        musicServiceBaseDomain,
        submissionClientAgent,
        playedTime,
      }) => ({
        uri,
        authorDid,
        createdAt,
        indexedAt,
        trackName,
        trackMbId,
        recordingMbId,
        duration,
        artistNames,
        artistMbIds,
        releaseName,
        releaseMbId,
        isrc,
        originUrl,
        musicServiceBaseDomain,
        submissionClientAgent,
        playedTime,
      }),
    ),
  } as OutputSchema;
}
