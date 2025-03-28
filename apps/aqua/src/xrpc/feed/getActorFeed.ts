import { TealContext } from '@/ctx';
import { artists, db, plays, playToArtists } from '@teal/db';
import { eq, and, lt, desc, sql } from 'drizzle-orm';
import { OutputSchema } from '@teal/lexicons/src/types/fm/teal/alpha/feed/getActorFeed';

export default async function getActorFeed(c: TealContext) {
  const params = c.req.query();
  if (!params.authorDID) {
    throw new Error('authorDID is required');
  }

  let limit = 20;

  if (params.limit) {
    limit = Number(params.limit);
    if (limit > 50) throw new Error('Limit is over max allowed.');
  }

  // 'and' is here for typing reasons
  let whereClause = and(eq(plays.did, params.authorDID));

  // Add cursor pagination if provided
  if (params.cursor) {
    const cursorResult = await db
      .select()
      .from(plays)
      .where(eq(plays.uri, params.cursor))
      .limit(1);

    const cursorPlay = cursorResult[0]?.playedTime;

    if (!cursorPlay) {
      throw new Error('Cursor not found');
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
        COALESCE(
          (
            SELECT jsonb_agg(jsonb_build_object('mbid', pa.artist_mbid, 'name', pa.artist_name))
            FROM ${playToArtists} pa
            WHERE pa.play_uri = ${plays.uri}
            AND pa.artist_mbid IS NOT NULL
            AND pa.artist_name IS NOT NULL -- Ensure both are non-null
          ),
          '[]'::jsonb -- Correct empty JSONB array literal
        )`.as('artists'),
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
  const cursor =
    playRes.length === limit ? playRes[playRes.length - 1]?.uri : undefined;

  return {
    cursor: cursor ?? undefined, // Ensure cursor itself can be undefined
    plays: playRes.map(
      ({
        // Destructure fields from the DB result
        trackName,
        cid: trackMbId, // Note the alias was used here in the DB query select
        recordingMbid,
        duration,
        artists, // This is guaranteed to be an array '[]' if no artists, due to COALESCE
        releaseName,
        releaseMbid,
        isrc,
        originUrl,
        musicServiceBaseDomain,
        submissionClientAgent,
        playedTime,
        // Other destructured fields like uri, did, etc. are not directly used here by name
      }) => ({
        // Apply '?? undefined' to each potentially nullable/undefined scalar field
        trackName: trackName ?? undefined,
        trackMbId: trackMbId ?? undefined,
        recordingMbId: recordingMbid ?? undefined,
        duration: duration ?? undefined,

        // For arrays derived from a guaranteed array, map is safe.
        // The SQL query ensures `artists` is '[]'::jsonb if empty.
        // The SQL query also ensures artist.name/mbid are NOT NULL within the jsonb_agg
        artistNames: artists.map((artist) => artist.name), // Will be [] if artists is []
        artistMbIds: artists.map((artist) => artist.mbid), // Will be [] if artists is []

        releaseName: releaseName ?? undefined,
        releaseMbId: releaseMbid ?? undefined,
        isrc: isrc ?? undefined,
        originUrl: originUrl ?? undefined,
        musicServiceBaseDomain: musicServiceBaseDomain ?? undefined,
        submissionClientAgent: submissionClientAgent ?? undefined,

        // playedTime specific handling: convert to ISO string if exists, else undefined
        playedTime: playedTime ? playedTime.toISOString() : undefined,
        // Alternative using optional chaining (effectively the same)
        // playedTime: playedTime?.toISOString(),
      }),
    ),
    // Explicitly cast to OutputSchema. Make sure OutputSchema allows undefined for these fields.
  } as OutputSchema;
}
