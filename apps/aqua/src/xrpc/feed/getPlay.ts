import { TealContext } from "@/ctx";
import { db, plays, playToArtists, artists } from "@teal/db";
import { eq, and, lt, desc, sql } from "drizzle-orm";
import { OutputSchema } from "@teal/lexicons/src/types/fm/teal/alpha/feed/getActorFeed";

export default async function getActorFeed(c: TealContext) {
  const params = c.req.query();
  if (!params.authorDid) {
    throw new Error("authorDid is required");
  }
  if (!params.rkey) {
    throw new Error("rkey is required");
  }

  // Get plays with artists as arrays
  const playRes = await db
    .select({
      play: plays,
      artists: sql<Array<{ mbid: string; name: string }>>`
        COALESCE(
          array_agg(
            CASE WHEN ${artists.mbid} IS NOT NULL THEN
              jsonb_build_object(
                'mbid', ${artists.mbid},
                'name', ${artists.name}
              )
            END
          ) FILTER (WHERE ${artists.mbid} IS NOT NULL),
          ARRAY[]::jsonb[]
        )
      `.as("artists"),
    })
    .from(plays)
    .leftJoin(playToArtists, sql`${plays.uri} = ${playToArtists.playUri}`)
    .leftJoin(artists, sql`${playToArtists.artistMbid} = ${artists.mbid}`)
    .where(and(eq(plays.did, params.authorDid), eq(plays.rkey, params.rkey)))
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
    .limit(1);

  if (playRes.length === 0) {
    throw new Error("Play not found");
  }

  return {
    plays: playRes.map(({ play, artists }) => {
      const {
        uri,
        did: authorDid,
        processedTime: createdAt,
        processedTime: indexedAt,
        trackName,
        cid: trackMbId,
        cid: recordingMbId,
        duration,
        rkey,
        releaseName,
        cid: releaseMbId,
        isrc,
        originUrl,
        musicServiceBaseDomain,
        submissionClientAgent,
        playedTime,
      } = play;

      return {
        uri,
        authorDid,
        createdAt: createdAt?.toISOString(),
        indexedAt: indexedAt?.toISOString(),
        trackName,
        trackMbId,
        recordingMbId,
        duration,
        // Replace these with actual artist data from the array
        artistNames: artists.map((artist) => artist.name),
        artistMbIds: artists.map((artist) => artist.mbid),
        // Or, if you want to keep the full artist objects:
        // artists: artists,
        releaseName,
        releaseMbId,
        isrc,
        originUrl,
        musicServiceBaseDomain,
        submissionClientAgent,
        playedTime: playedTime?.toISOString(),
      };
    }),
  } as OutputSchema;
}
