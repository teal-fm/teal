import { TealContext } from '@/ctx';
import { db, profiles } from '@teal/db';
import { eq } from 'drizzle-orm';
import { OutputSchema } from '@teal/lexicons/src/types/fm/teal/alpha/actor/getProfile';

export default async function getProfile(c: TealContext) {
  const params = c.req.query();
  if (!params.actor) {
    throw new Error('actor is required');
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
    throw new Error('Profile not found');
  }

  profile = profile[0];

  const res: OutputSchema = {
    actor: {
      did: profile.did,
      handle: profile.handle,
      displayName: profile.displayName || undefined,
      description: profile.description || undefined,
      descriptionFacets: [],
      avatar: profile.avatar || undefined,
      banner: profile.banner || undefined,
      createdAt: profile.createdAt?.toISOString(),
    },
  };

  return res;
}
