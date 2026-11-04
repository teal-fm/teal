import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useStore } from "@/stores/mainStore";

import {
  getReactions,
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
  reactions: (subject: string, viewer?: string) => ["reactions", subject, viewer ?? null] as const,
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
  const patchPost = (post: SocialPostView) =>
    post.uri === subjectUri ? { ...post, reactions: update(post.reactions ?? []) } : post;
  client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["actor-posts"] }, (posts) =>
    posts && { ...posts, pages: posts.pages.map((page) => ({ ...page, items: page.items.map(patchPost) })) },
  );
  client.setQueriesData<SocialPostView>({ queryKey: ["post", subjectUri] }, (post) => post && patchPost(post));
  client.setQueriesData<SocialPostView[]>({ queryKey: ["replies"] }, (replies) => replies?.map(patchPost));
  client.setQueryData<ReactionSummary[]>(keys.reactions(subjectUri, viewer), (summaries) => summaries && update(summaries));
}

/** The reactions on one subject, for pages (like a listen) whose views don't carry them. */
export function useReactionsQuery(subject?: string) {
  const viewer = useViewerDid();
  return useQuery({
    queryKey: keys.reactions(subject ?? "", viewer),
    queryFn: () => getReactions(subject!, viewer).then((r) => r.summary),
    enabled: !!subject,
  });
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

/**
 * Drops a deleted post from every cached list straight away. The index takes a
 * moment to catch up, so a refetch alone would bring it back.
 */
export function forgetPost(client: ReturnType<typeof useQueryClient>, uri: string, parentUri?: string) {
  const keep = (post: SocialPostView) => post.uri !== uri;
  for (const key of [["feed"], ["actor-posts"]]) {
    client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: key }, (pages) =>
      pages && { ...pages, pages: pages.pages.map((page) => ({ ...page, items: page.items.filter(keep) })) },
    );
  }
  client.setQueriesData<SocialPostView[]>({ queryKey: ["replies"] }, (replies) => replies?.filter(keep));
  client.removeQueries({ queryKey: ["post", uri] });
  if (parentUri) {
    client.setQueriesData<SocialPostView>({ queryKey: ["post", parentUri] }, (parent) =>
      parent && { ...parent, replyCount: Math.max(0, parent.replyCount - 1) },
    );
  }
}

/**
 * Shows a post you just published without waiting for the index: a new post leads
 * your feed and your profile's posts; a reply joins its thread and bumps the count.
 */
export function rememberPost(client: ReturnType<typeof useQueryClient>, viewer: string, post: SocialPostView) {
  if (post.replyParentUri) {
    client.setQueriesData<SocialPostView[]>({ queryKey: ["replies", post.replyParentUri] }, (replies) =>
      replies && !replies.some((r) => r.uri === post.uri) ? [...replies, post] : replies,
    );
    client.setQueriesData<SocialPostView>({ queryKey: ["post", post.replyParentUri] }, (parent) =>
      parent && { ...parent, replyCount: parent.replyCount + 1 },
    );
    return;
  }
  const prepend = (pages: InfiniteData<FeedPage> | undefined) =>
    pages && {
      ...pages,
      pages: pages.pages.map((page, i) => (i === 0 ? { ...page, items: [post, ...page.items.filter((p) => p.uri !== post.uri)] } : page)),
    };
  client.setQueryData<InfiniteData<FeedPage>>(keys.feed(viewer), prepend);
  client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["actor-posts", viewer] }, prepend);
}
