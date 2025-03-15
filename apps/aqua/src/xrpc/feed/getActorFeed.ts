import { TealContext } from "@/ctx";
import { artists, db, plays, playToArtists } from "@teal/db";
import { eq, and, lt, desc, sql } from "drizzle-orm";
import { OutputSchema } from "@teal/lexicons/src/types/fm/teal/alpha/feed/getActorFeed";

export default async function getActorFeed(c: TealContext) {
  const params = c.req.query();
  if (!params.authorDid) {
    throw new Error("authorDid is required");
  }

  let limit = 20;

  if (params.limit) {
    limit = Number(params.limit);
    if (limit > 50) throw new Error("Limit is over max allowed.");
  }

  // 'and' is here for typing reasons
  let whereClause = and(eq(plays.did, params.authorDid));

  // Add cursor pagination if provided
  if (params.cursor) {
    const cursorResult = await db
      .select()
      .from(plays)
      .where(eq(plays.uri, params.cursor))
      .limit(1);

    const cursorPlay = cursorResult[0]?.playedTime;

    if (!cursorPlay) {
      throw new Error("Cursor not found");
    }

    whereClause = and(whereClause, lt(plays.playedTime, cursorPlay as any));
  }

  const playRes = await db
    .select({
      uri: plays.uri,
      did: plays.did,
      playedTime: plays.playedTime,
      trackName: plays.trackName,
      cid: plays.cid,
      recordingMbid: plays.recordingMbid,
      duration: plays.duration,
      releaseName: plays.releaseName,
      releaseMbid: plays.releaseMbid,
      isrc: plays.isrc,
      originUrl: plays.originUrl,
      processedTime: plays.processedTime,
      submissionClientAgent: plays.submissionClientAgent,
      musicServiceBaseDomain: plays.musicServiceBaseDomain,
      artists: sql<Array<{ mbid: string; name: string }>>`
COALESCE
array_agg(
CASE WHEN ${playToArtists.artistMbid} IS NOT NULL THEN
  jsonb_build_object(
    'mbid', ${playToArtists.artistMbid},
    'name', ${playToArtists.artistName}
  )
END
) FILTER (WHERE ${playToArtists.artistName} IS NOT NULL),
ARRAY[]::jsonb[]
)
`.as("artists"),
    })
    .from(plays)
    .leftJoin(playToArtists, sql`${plays.uri} = ${playToArtists.playUri}`)
    .where(whereClause)
    .groupBy(
      plays.uri,
      plays.cid,
      plays.did,
      plays.duration,
      plays.isrc,
      plays.musicServiceBaseDomain,
      plays.originUrl,
      plays.playedTime,
      plays.processedTime,
      plays.rkey,
      plays.recordingMbid,
      plays.releaseMbid,
      plays.releaseName,
      plays.submissionClientAgent,
      plays.trackName,
    )
    .orderBy(desc(plays.playedTime))
    .limit(limit);

  if (playRes.length === 0) {
    throw new Error("Play not found");
  }

  return {
    plays: playRes.map(
      ({
        uri,
        did: authorDid,
        processedTime: createdAt,
        processedTime: indexedAt,
        trackName,
        cid: trackMbId,
        recordingMbid,
        duration,
        artists,
        releaseName,
        releaseMbid,
        isrc,
        originUrl,
        musicServiceBaseDomain,
        submissionClientAgent,
        playedTime,
      }) => ({
        uri,
        authorDid,
        createdAt: createdAt?.toISOString(),
        indexedAt: indexedAt?.toISOString(),
        trackName,
        trackMbId,
        recordingMbId: recordingMbid,
        duration,
        artistNames: artists.map((artist) => artist.name),
        artistMbIds: artists.map((artist) => artist.mbid),
        releaseName,
        releaseMbId: releaseMbid,
        isrc,
        originUrl,
        musicServiceBaseDomain,
        submissionClientAgent,
        playedTime: playedTime?.toISOString(),
      }),
    ),
  } as OutputSchema;
}
