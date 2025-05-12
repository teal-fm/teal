import { TealContext } from "@/ctx";
import { db, plays, profiles } from "@teal/db";
import { OutputSchema } from "@teal/lexicons/src/types/fm/teal/alpha/actor/getTopAlbums";
import { eq } from "drizzle-orm";

export default async function getTopAlbums(c: TealContext) {
  const params = c.req.query();
  if (!params.actor) {
    throw new Error("actor is required");
  }

  // Assuming 'user' can be either a DID or a handle.  We'll try to resolve
  // the DID first, and if that fails, try to resolve the handle.
  let profile;

  //First try to get by did
  profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.did, params.actor))
    .limit(1);

  //If not found, try to get by handle
  if (!profile) {
    profile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.handle, params.actor))
      .limit(1);
  }

  if (!profile) {
    throw new Error("Profile not found");
  }

  profile = profile[0];

  const playsQuery = await db
    .select()
    .from(plays)
    .where(eq(plays.did, profile.did))

    .limit(100);

  const albums = playsQuery.map((play) => {
    return {
      albumName: play.releaseName,
      // TODO: okay so this isn't in the db ?!
      albumArtist: play.releaseName,
      // TODO: see how its implemented on frontend
      // albumArt: play.,
      albumReleaseMBID: play.releaseMbid,
    };
  });

  // TODO: idk this probably sucks, i'm going to bed im tired
  const albumCounts = albums.reduce((acc: Record<string, number>, album) => {
    if (album.albumName && album.albumArtist) {
      acc[album.albumName] = (acc[album.albumName] || 0) + 1;
    }
    return acc;
  }, {});
  const sortedAlbums = Object.entries(albumCounts).sort((a, b) => b[1] - a[1]);
  const topAlbums = sortedAlbums.slice(0, Number(params.limit) || 10);

  const res: OutputSchema = {
    actor: {
      did: profile.did,
      displayName: profile.displayName || undefined,
      description: profile.description || undefined,
      descriptionFacets: [],
      avatar: profile.avatar || undefined,
      banner: profile.banner || undefined,
      createdAt: profile.createdAt?.toISOString(),
    },
    // TODO: actually implement this
    albums: topAlbums.map(([albumName]) => ({
      albumName,
      albumArtist: "", // TODO: Get actual artist name
      albumArt: undefined,
      albumReleaseMBID: undefined,
    })),
  };

  return res;
}
