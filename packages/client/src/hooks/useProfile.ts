import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import type { AppBskyActorDefs } from "@atproto/api";
import type { ProfileView } from "@teal/lexicons/src/fm/teal/actor/defs";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { resolveHandle } from "../atp/pid";
import {
  getActorFeed,
  getActorPlaylists,
  getBlueskyProfile,
  getGraphFollowers,
  getGraphFollows,
  getGraphSummary,
  getProfile,
  getSocialFeed,
  XrpcError,
  type GraphSummaryView,
} from "../teal/api";
import { documentIdentity } from "../teal/actors";
import { rkeyFromAtUri } from "../teal/routes";
import { usePdsAgent, useViewerDid } from "../session";

export type DisplayProfile = Pick<
  ProfileView,
  "displayName" | "description" | "descriptionFacets" | "avatar" | "banner" | "status" | "statsDefaultPeriod" | "favorites"
> & { handle?: string };

/** Teal's own fields win; Bluesky fills what a teal profile hasn't set yet. */
function withBluesky(profile: DisplayProfile, bsky: AppBskyActorDefs.ProfileViewDetailed): DisplayProfile {
  return {
    ...profile,
    avatar: profile.avatar || bsky.avatar,
    banner: profile.banner || bsky.banner,
    description: profile.description || bsky.description,
    displayName: profile.displayName || bsky.displayName,
    handle: profile.handle || bsky.handle,
  };
}

export const profileKeys = {
  did: (actor: string) => ["actor-did", actor] as const,
  profile: (did: string) => ["profile", did] as const,
  graph: (did: string, viewer?: string) => ["graph", did, viewer ?? null] as const,
};

/** Neither teal nor Bluesky knows this account. */
export class ProfileNotFoundError extends Error {}

/** A handle or DID from the URL, resolved to a DID. */
export function useActorDid(actor?: string) {
  return useQuery({
    queryKey: profileKeys.did(actor ?? ""),
    queryFn: () => (actor!.startsWith("did:") ? actor! : resolveHandle(actor!)),
    enabled: !!actor,
    staleTime: Infinity,
  });
}

/**
 * Someone's profile. Without a teal profile yet, Bluesky's details stand in and
 * `fromBluesky` says so, so their own page can offer to set one up.
 */
export function useProfile(did?: string, handleHint?: string) {
  return useQuery({
    queryKey: profileKeys.profile(did ?? ""),
    enabled: !!did,
    retry: (count, error) => !(error instanceof ProfileNotFoundError) && !(error instanceof XrpcError && error.status < 500) && count < 2,
    queryFn: async () => {
      let profile: DisplayProfile;
      let fromBluesky = false;
      try {
        profile = (await getProfile(did!)).profile;
        fromBluesky = !profile.displayName && !profile.description && !profile.avatar && !profile.banner;
      } catch (error) {
        if (!(error instanceof XrpcError) || error.status !== 404) throw error;
        profile = { handle: handleHint };
        fromBluesky = true;
      }
      if (!profile.avatar || !profile.displayName || !profile.handle || !profile.description) {
        // Only Bluesky answering 400 means the account doesn't exist. An outage, rate
        // limit, or blocked network just means no Bluesky details this time.
        let unknownToBluesky = false;
        const bsky = await getBlueskyProfile(did!).catch((error) => {
          unknownToBluesky = error instanceof XrpcError && error.status === 400;
          return null;
        });
        if (bsky) profile = withBluesky(profile, bsky);
        else if (fromBluesky && unknownToBluesky && !profile.displayName && !profile.avatar) {
          // An account off Bluesky still exists while its DID document resolves, and
          // then shows its handle, or just its DID.
          const documented = await documentIdentity(did!);
          if (!documented) throw new ProfileNotFoundError(did!);
          profile = { ...profile, handle: profile.handle ?? documented.handle };
        }
      }
      return { profile, fromBluesky };
    },
  });
}

export function useGraphSummary(did?: string) {
  const viewer = useViewerDid();
  return useQuery({
    queryKey: profileKeys.graph(did ?? "", viewer),
    queryFn: () => getGraphSummary(did!, viewer),
    enabled: !!did,
  });
}

/** Follow or unfollow, updating the count and button straight away. */
export function useToggleFollow(did?: string) {
  const viewer = useViewerDid();
  const agent = usePdsAgent();
  const client = useQueryClient();
  const key = profileKeys.graph(did ?? "", viewer);
  return useMutation({
    mutationFn: async (current?: string) => {
      if (!agent || !viewer || !did) throw new Error("not signed in");
      if (current) {
        const rkey = rkeyFromAtUri(current);
        if (!rkey) throw new Error("unknown follow record");
        await agent.call("com.atproto.repo.deleteRecord", {}, { repo: viewer, collection: "fm.teal.graph.follow", rkey });
        return undefined;
      }
      const res = await agent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: viewer,
          collection: "fm.teal.graph.follow",
          record: { $type: "fm.teal.graph.follow", subject: did, createdAt: new Date().toISOString() },
        },
      );
      return (res.data as { uri?: string }).uri;
    },
    onSuccess: (uri, current) => {
      client.setQueryData<GraphSummaryView>(key, (summary) =>
        summary && {
          ...summary,
          followersCount: Math.max(0, summary.followersCount + (current ? -1 : 1)),
          viewerFollowing: uri,
        },
      );
    },
  });
}

export function usePeople(did: string, kind: "followers" | "following") {
  return useInfiniteQuery({
    queryKey: ["people", did, kind],
    queryFn: ({ pageParam }) => (kind === "followers" ? getGraphFollowers : getGraphFollows)(did, 20, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
  });
}

export function useActorPlays(did?: string) {
  return useInfiniteQuery({
    queryKey: ["actor-plays", did],
    queryFn: ({ pageParam }) => getActorFeed(did!, 30, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
    enabled: !!did,
  });
}

export function useActorPosts(did?: string) {
  const viewer = useViewerDid();
  return useInfiniteQuery({
    queryKey: ["actor-posts", did, viewer ?? null],
    queryFn: ({ pageParam }) => getSocialFeed(10, pageParam, viewer, did),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
    enabled: !!did,
  });
}

export function useActorPlaylists(did?: string) {
  return useInfiniteQuery({
    queryKey: ["actor-playlists", did],
    queryFn: ({ pageParam }) => getActorPlaylists(did!, 12, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
    enabled: !!did,
  });
}

/**
 * Edits or removes listens in someone's cached history in place. The index lags
 * writes, so refetching would bring back what was just deleted or changed.
 * Return null from `update` to remove a listen.
 */
export function patchActorPlays(client: QueryClient, did: string, update: (play: PlayView) => PlayView | null) {
  client.setQueryData<InfiniteData<{ plays: PlayView[]; cursor?: string }>>(["actor-plays", did], (data) =>
    data && {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        plays: page.plays.flatMap((play) => {
          const next = update(play);
          return next ? [next] : [];
        }),
      })),
    },
  );
}
