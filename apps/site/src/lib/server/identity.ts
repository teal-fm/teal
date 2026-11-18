import type { Profile, Profiles } from "../types";
import { cached, cachedMany } from "./cache";

const SLINGSHOT = "https://slingshot.microcosm.blue";
const BSKY = "https://public.api.bsky.app";

interface MiniDoc {
  did: string;
  handle: string;
  pds: string;
}

/** Resolves a handle or DID through Slingshot's cache; undefined when it doesn't exist. */
export function resolveActor(actor: string): Promise<MiniDoc | undefined> {
  const identifier = actor.trim().replace(/^@/, "").toLowerCase();

  return cached(`id:${identifier}`, 600, async () => {
    const response = await fetch(
      `${SLINGSHOT}/xrpc/com.bad-example.identity.resolveMiniDoc?identifier=${encodeURIComponent(identifier)}`,
    );
    if (response.status === 400 || response.status === 404) return undefined;
    if (!response.ok) throw new Error(`Slingshot: ${response.status}`);

    return (await response.json()) as MiniDoc;
  });
}

/** Bluesky profiles, 25 to a request; accounts Bluesky doesn't know are left out. */
async function bskyProfiles(dids: string[]): Promise<Record<string, Profile>> {
  const found: Record<string, Profile> = {};
  const chunks = [];
  for (let i = 0; i < dids.length; i += 25) chunks.push(dids.slice(i, i + 25));

  await Promise.all(
    chunks.map(async (chunk) => {
      const query = chunk
        .map((did) => `actors=${encodeURIComponent(did)}`)
        .join("&");
      const response = await fetch(
        `${BSKY}/xrpc/app.bsky.actor.getProfiles?${query}`,
      );
      if (!response.ok) return;
      const body = (await response.json()) as { profiles: Profile[] };
      for (const { did, handle, displayName, avatar } of body.profiles) {
        found[did] = { did, handle, displayName, avatar };
      }
    }),
  );

  return found;
}

/**
 * Names and avatars for a set of accounts, from Bluesky's public AppView.
 * Accounts Bluesky doesn't know fall back to the handle in their DID document.
 */
export async function getProfiles(dids: Iterable<string>): Promise<Profiles> {
  const unique = [...new Set(dids)];
  const known = await cachedMany("bsky", unique, 600, bskyProfiles).catch(
    () => ({}) as Profiles,
  );
  const profiles = await Promise.all(
    unique.map(async (did): Promise<Profile> => {
      const profile = known[did];
      if (profile?.handle && profile.handle !== "handle.invalid")
        return profile;
      const doc = await resolveActor(did).catch(() => undefined);

      return { ...profile, did, handle: doc?.handle };
    }),
  );

  return Object.fromEntries(profiles.map((profile) => [profile.did, profile]));
}
