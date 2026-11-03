import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useStore } from "@/stores/mainStore";

import {
  getSocialFeed,
  getToday,
  type ReactionSummary,
  type SocialPostView,
  type TodayView,
} from "./api";
import { dedupeMoments } from "./today";
import {
  addReaction,
  removeReaction,
  withViewerReaction,
  type ReactionSubject,
} from "./reactions";

export const keys = {
  today: (viewer?: string) => ["today", viewer ?? null] as const,
  feed: (viewer?: string) => ["feed", viewer ?? null] as const,
};

export function useViewerDid() {
  const status = useStore((state) => state.status);
  const did = useStore((state) => state.pdsAgent?.did);
  return status === "loggedIn" ? did : undefined;
}

export function useTodayQuery() {
  const viewer = useViewerDid();
  return useQuery({
    queryKey: keys.today(viewer),
    queryFn: () => getToday(viewer),
    select: (today) => ({
      ...today,
      moments: dedupeMoments(today.moments),
      heatingUp: dedupeMoments(today.heatingUp),
    }),
    refetchInterval: 60_000,
  });
}

type FeedPage = Awaited<ReturnType<typeof getSocialFeed>>;

export function useFeedQuery() {
  const viewer = useViewerDid();
  return useInfiniteQuery({
    queryKey: keys.feed(viewer),
    queryFn: ({ pageParam }) => getSocialFeed(20, pageParam, viewer),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: FeedPage) => last.cursor,
  });
}

/** Applies `update` to the reactions of `subjectUri` wherever it is cached. */
function patchReactions(
  client: ReturnType<typeof useQueryClient>,
  viewer: string | undefined,
  subjectUri: string,
  update: (summaries: ReactionSummary[]) => ReactionSummary[],
) {
  client.setQueryData<TodayView>(keys.today(viewer), (today) =>
    today && {
      ...today,
      listening: today.listening.map((l) =>
        l.playUri === subjectUri ? { ...l, reactions: update(l.reactions) } : l,
      ),
    },
  );
  client.setQueryData<InfiniteData<FeedPage>>(keys.feed(viewer), (feed) =>
    feed && {
      ...feed,
      pages: feed.pages.map((page) => ({
        ...page,
        items: page.items.map((post: SocialPostView) =>
          post.uri === subjectUri
            ? { ...post, reactions: update(post.reactions ?? []) }
            : post,
        ),
      })),
    },
  );
}

/**
 * Toggles the viewer's `emoji` reaction on a subject. The cache updates at once;
 * a failed write restores it.
 */
export function useToggleReaction() {
  const client = useQueryClient();
  const agent = useStore((state) => state.pdsAgent);
  const viewer = useViewerDid();
  return useMutation({
    mutationFn: async (input: {
      subject: ReactionSubject;
      emoji: string;
      existing?: string;
    }) => {
      if (!agent) throw new Error("Sign in to react.");
      if (input.existing) {
        await removeReaction(agent, input.existing);
        return undefined;
      }
      return addReaction(agent, input.subject, input.emoji);
    },
    onMutate: async ({ subject, emoji, existing }) => {
      const pending = existing ? undefined : "pending";
      patchReactions(client, viewer, subject.uri, (s) =>
        withViewerReaction(s, emoji, pending),
      );
    },
    onSuccess: (uri, { subject, emoji }) => {
      if (uri) {
        patchReactions(client, viewer, subject.uri, (s) =>
          withViewerReaction(s, emoji, uri),
        );
      }
    },
    onError: (_error, { subject, emoji, existing }) => {
      patchReactions(client, viewer, subject.uri, (s) =>
        withViewerReaction(s, emoji, existing),
      );
    },
  });
}
