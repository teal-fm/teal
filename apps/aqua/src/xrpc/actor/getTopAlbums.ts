import { TealContext } from "@/ctx";
import { db, mvTopReleasesPerUser30Days, profiles } from "@teal/db";
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

  const topReleases30Days = await db
    .select()
    .from(mvTopReleasesPerUser30Days)
    .where(eq(mvTopReleasesPerUser30Days.userDid, profile.did))
    .limit(Number(params.limit) ?? 10);

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
    albums: topReleases30Days.map((release) => ({
      albumName: release.releaseName,
      albumArtist: release.releaseName,
      albumArt: undefined,
      albumReleaseMBID: release.releaseMbid,
    })),
  };

  return res;
}
