import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Bell, Heart, MessageCircle, Repeat2, SmilePlus, UserPlus, type LucideIcon } from "lucide-react-native";
import { actorAvatarUrl, actorProfileHref, displayActorName } from "@/lib/teal/actors";
import {
  displayArtists,
  getNotifications,
  getSocialPost,
  XrpcError,
  type SocialNotificationView,
} from "@/lib/teal/api";
import { useViewerDid } from "@/lib/teal/queries";
import { postHrefFromUri } from "@/lib/teal/routes";
import { trackViewToPlayView } from "@/lib/teal/social";
import { shortAgo } from "@/lib/teal/today";
import {
  Avatar,
  Button,
  Cover,
  ErrorNotice,
  Glass,
  Icon,
  Loading,
  Notice,
  Screen,
  Text,
} from "@/next/components/ds";

const REASONS: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  like: { label: "liked your post", icon: Heart, tone: "text-rose-500" },
  repost: { label: "reposted your post", icon: Repeat2, tone: "text-tint" },
  reply: { label: "replied to your post", icon: MessageCircle, tone: "text-tint" },
  reaction: { label: "reacted to your post", icon: SmilePlus, tone: "text-tint" },
  follow: { label: "followed you", icon: UserPlus, tone: "text-tint" },
  badgeAssignment: { label: "gave you a badge", icon: Bell, tone: "text-ink-2" },
};
const OTHER = { label: "interacted with your profile", icon: Bell, tone: "text-ink-2" };

type Group = { key: string; reason: string; items: SocialNotificationView[]; contextUri?: string };

/** Likes, reposts, replies, and reactions on the same post fold into one row. */
function group(items: SocialNotificationView[]) {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const contextUri = item.reason === "reply" ? item.recordUri : item.subjectUri;
    const groupable = contextUri && ["like", "repost", "reply", "reaction"].includes(item.reason);
    const key = groupable ? `${item.reason}:${contextUri}` : `n:${item.id}`;
    const existing = groups.get(key);
    if (existing) existing.items.push(item);
    else groups.set(key, { key, reason: item.reason, items: [item], contextUri: groupable ? contextUri : undefined });
  }
  return [...groups.values()];
}

/** Activity: who liked, replied, reacted, and followed. */
export default function Activity() {
  const viewer = useViewerDid();
  const feed = useInfiniteQuery({
    queryKey: ["notifications", viewer],
    queryFn: ({ pageParam }) => getNotifications(viewer!, 30, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
    enabled: !!viewer,
  });
  const groups = useMemo(() => group(feed.data?.pages.flatMap((p) => p.items) ?? []), [feed.data]);

  if (!viewer) {
    return (
      <Screen title="Activity">
        <Notice
          center
          icon={Bell}
          title="Sign in to see your activity"
          body="Replies, likes, reactions, and new followers show up here."
          action={
            <Link href="/auth/login" asChild>
              <Button label="Sign in" />
            </Link>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Activity"
      onScroll={(event) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const nearEnd = layoutMeasurement.height + contentOffset.y > contentSize.height - 600;
        if (nearEnd && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      }}
    >
      {feed.isLoading ? (
        <Loading />
      ) : feed.isError ? (
        <ErrorNotice title="Your activity didn't load" onRetry={() => feed.refetch()} />
      ) : groups.length === 0 ? (
        <Notice title="Nothing yet" body="When people reply, like, react, or follow you, it shows up here." />
      ) : (
        <Glass className="px-4">
          {groups.map((g, i) => (
            <ActivityRow key={g.key} group={g} last={i === groups.length - 1} />
          ))}
        </Glass>
      )}
      {feed.isFetchingNextPage ? <Loading className="py-6" /> : null}
    </Screen>
  );
}

function ActivityRow({ group: g, last }: { group: Group; last: boolean }) {
  const known = REASONS[g.reason] ?? OTHER;
  // Reactions land on listens as well as posts.
  const reason =
    g.reason === "reaction" && g.contextUri?.includes(".feed.play/") ? { ...known, label: "reacted to your listen" } : known;
  const first = g.items[0];
  const others = g.items.length - 1;
  const href = g.contextUri ? postHrefFromUri(g.contextUri) : undefined;

  return (
    <View className={last ? "py-4" : "border-b border-hair py-4"}>
      <View className="flex-row gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-fill">
          <Icon icon={reason.icon} size={19} className={reason.tone} />
        </View>
        <View className="min-w-0 flex-1 gap-2">
          <View className="flex-row">
            {g.items.slice(0, 4).map((item, index) => {
              const did = item.actor?.did || item.actorDid;
              const name = displayActorName(item.actor, did);
              return (
                <Link key={item.id} href={`/profile/${actorProfileHref(item.actor, did)}` as never} asChild>
                  <Pressable accessibilityLabel={`${name}'s profile`} style={{ marginLeft: index ? -8 : 0, zIndex: 4 - index }}>
                    <Avatar did={did} avatar={actorAvatarUrl(item.actor, did)} name={name} size={36} className="border-2 border-ground" />
                  </Pressable>
                </Link>
              );
            })}
          </View>
          <Text className="text-[15px] leading-[21px]">
            <Text className="font-semibold">{displayActorName(first.actor, first.actor?.did || first.actorDid)}</Text>
            {others > 0 ? ` and ${others} ${others === 1 ? "other" : "others"}` : ""} {reason.label}
            <Text className="text-ink-2"> · {shortAgo(first.createdAt)}</Text>
          </Text>
          {href && g.contextUri ? <PostPreview uri={g.contextUri} href={href} /> : null}
        </View>
      </View>
    </View>
  );
}

function PostPreview({ uri, href }: { uri: string; href: string }) {
  const post = useQuery({
    queryKey: ["post", uri, null],
    queryFn: () => getSocialPost(uri).then((r) => r.post),
    retry: (count, error) => !(error instanceof XrpcError && error.status === 404) && count < 2,
  });
  if (post.isLoading) {
    return <View className="h-16 rounded-[16px] bg-fill" />;
  }
  if (post.isError || !post.data) {
    const gone = post.error instanceof XrpcError && post.error.status === 404;
    return gone ? (
      <Text className="text-[14px] text-ink-2">The original post is no longer available.</Text>
    ) : (
      <View className="flex-row items-center gap-3">
        <Text className="text-[14px] text-ink-2">This post didn't load.</Text>
        <Button label="Try again" variant="secondary" size="sm" onPress={() => post.refetch()} />
      </View>
    );
  }
  const play = trackViewToPlayView(post.data.track);
  return (
    <Link href={href as never} asChild>
      <Pressable accessibilityLabel="Open the post" className="flex-row items-center gap-3 rounded-[16px] bg-fill p-2.5 web:hover:opacity-85">
        <Cover releaseMbId={play.releaseMbId} size={44} radius={8} />
        <View className="min-w-0 flex-1">
          <Text className="text-[15px]" numberOfLines={2}>
            {post.data.text || play.trackName}
          </Text>
          <Text className="text-[13px] text-ink-2" numberOfLines={1}>
            {play.trackName} · {displayArtists(play) || "Unknown artist"}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
