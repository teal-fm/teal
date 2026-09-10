import { getBlueskyProfile } from "@/lib/teal/api";

import type { MiniProfileView } from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";

export type DisplayActor = {
  avatar?: string;
  did?: string;
  displayName?: string;
  handle?: string;
};

const blueskyProfileCache = new Map<string, Promise<DisplayActor | undefined>>();

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

export function getCachedBlueskyProfile(did: string) {
  let profile = blueskyProfileCache.get(did);
  if (!profile) {
    profile = getBlueskyProfile(did)
      .then(({ avatar, displayName, handle }) => ({
        avatar,
        did,
        displayName,
        handle,
      }))
      .catch(() => undefined);
    blueskyProfileCache.set(did, profile);
  }
  return profile;
}

export function displayActorName(
  actor: DisplayActor | MiniProfileView | undefined,
  did?: string,
) {
  const handle = normalizeHandle(actor?.handle);
  return actor?.displayName || handle || did || "Unknown listener";
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
