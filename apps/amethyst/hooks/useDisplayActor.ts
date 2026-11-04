import { useQuery } from "@tanstack/react-query";
import type { MiniProfileView } from "@teal/lexicons/src/fm/teal/actor/defs";
import { actorAvatarUrl, actorProfileHref, displayActorName, getCachedBlueskyProfile, type DisplayActor } from "@/lib/teal/actors";

/**
 * An indexed actor, with Bluesky filling a missing name or handle. Returns what a
 * row needs: a name, a profile href, and an avatar URL.
 */
export function useDisplayActor(actor: DisplayActor | MiniProfileView | undefined, did?: string) {
  const id = actor?.did || did;
  const needsFallback = !!id && (!actor?.displayName || !actor?.handle);
  const bluesky = useQuery({
    queryKey: ["bsky-actor", id],
    queryFn: async () => (await getCachedBlueskyProfile(id!)) ?? null,
    enabled: needsFallback,
    staleTime: (query) => (query.state.data ? Infinity : 10 * 60_000),
  });
  const merged: DisplayActor | undefined = bluesky.data
    ? {
        ...bluesky.data,
        ...actor,
        avatar: actor?.avatar || bluesky.data.avatar,
        displayName: actor?.displayName || bluesky.data.displayName,
        handle: actor?.handle || bluesky.data.handle,
      }
    : actor;
  return {
    did: id,
    name: displayActorName(merged, id),
    href: `/profile/${actorProfileHref(merged, id)}`,
    // A teal avatar is a blob CID; Bluesky's is already a URL.
    avatar: actor?.avatar ? actorAvatarUrl(actor, id) : merged?.avatar,
  };
}
