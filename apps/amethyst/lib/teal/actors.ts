import { getDidDocument, resolveHandle } from "@/lib/atp/pid";
import { getBlueskyProfile } from "@/lib/teal/api";

import type { MiniProfileView } from "@teal/lexicons/src/fm/teal/actor/defs";

export type DisplayActor = {
  avatar?: string;
  did?: string;
  displayName?: string;
  handle?: string;
};

const blueskyProfileCache = new Map<
  string,
  Promise<DisplayActor | undefined>
>();

export function isHttpUrl(value?: string) {
  return value?.startsWith("http://") || value?.startsWith("https://");
}

export function normalizeHandle(value?: string) {
  return value?.replace(/^at:\/\//, "").replace(/^@/, "");
}

export function getProfileImageUrl(
  did: string,
  value?: string,
  kind: "avatar" | "banner" = "avatar",
) {
  if (!value) return undefined;
  if (
    isHttpUrl(value) ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }
  if (value.startsWith("at://")) return value;
  return `https://cdn.bsky.app/img/${kind}/plain/${did}/${value}@jpeg`;
}

/**
 * The handle an account's DID document claims, kept only when the handle resolves
 * back to the same DID, so a document can't borrow someone else's name.
 */
async function verifiedDocumentHandle(did: string) {
  const doc = (await getDidDocument(did)) as { alsoKnownAs?: string[] } | undefined;
  const handle = doc?.alsoKnownAs
    ?.find((aka) => aka.startsWith("at://"))
    ?.slice("at://".length);
  if (!handle) return undefined;
  return (await resolveHandle(handle).catch(() => undefined)) === did ? handle : undefined;
}

/**
 * Who a DID is, for accounts teal hasn't indexed a profile for: Bluesky's profile,
 * or for an account Bluesky doesn't know, the handle in its DID document.
 */
async function lookupActor(did: string): Promise<DisplayActor | undefined> {
  const bluesky = await getBlueskyProfile(did).catch(() => undefined);
  const handle =
    bluesky?.handle && bluesky.handle !== "handle.invalid" ? bluesky.handle : undefined;
  if (handle) {
    return { avatar: bluesky?.avatar, did, displayName: bluesky?.displayName, handle };
  }
  const documented = await verifiedDocumentHandle(did);
  if (!bluesky && !documented) throw new Error(`No identity found for ${did}`);
  return { avatar: bluesky?.avatar, did, displayName: bluesky?.displayName, handle: documented };
}

export function getCachedBlueskyProfile(did: string) {
  let profile = blueskyProfileCache.get(did);
  if (!profile) {
    profile = lookupActor(did)
      .catch(() => {
        // A temporary lookup failure must not become a permanent cached identity.
        blueskyProfileCache.delete(did);
        return undefined;
      });
    blueskyProfileCache.set(did, profile);
  }
  return profile;
}

export function displayActorName(
  actor: DisplayActor | MiniProfileView | undefined,
  did?: string,
) {
  const handle = normalizeHandle(actor?.handle);
  return (
    actor?.displayName ||
    handle ||
    // With no profile anywhere, the DID is the one honest name to show.
    did ||
    "Unknown listener"
  );
}

export function actorProfileHref(
  actor: DisplayActor | MiniProfileView | undefined,
  did?: string,
) {
  return normalizeHandle(actor?.handle) || actor?.did || did || "unknown";
}

export function actorAvatarUrl(
  actor: DisplayActor | MiniProfileView | undefined,
  did?: string,
) {
  const authorDid = actor?.did || did;
  if (!authorDid || !actor?.avatar) return undefined;
  return getProfileImageUrl(authorDid, actor.avatar, "avatar");
}
