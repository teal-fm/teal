import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Link, Stack } from "expo-router";
import RightRail from "@/components/teal/RightRail";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  displayArtists,
  getNotifications,
  getSocialPost,
  type SocialNotificationView,
  type SocialPostView,
} from "@/lib/teal/api";
import {
  actorAvatarUrl,
  actorProfileHref,
  displayActorName,
} from "@/lib/teal/actors";
import { postHrefFromUri } from "@/lib/teal/routes";
import { trackViewToPlayView } from "@/lib/teal/social";
import { useStore } from "@/stores/mainStore";
import {
  Bell,
  ChevronRight,
  Disc3,
  Heart,
  MessageCircle,
  Repeat2,
} from "lucide-react-native";

function reasonLabel(reason: string) {
  switch (reason) {
    case "like":
      return "liked your post";
    case "repost":
      return "reposted your post";
    case "reply":
      return "replied to your post";
    case "follow":
      return "followed you";
    case "badgeAssignment":
      return "gave you a badge";
    default:
      return reason;
  }
}

function reasonIcon(reason: string) {
  switch (reason) {
    case "like":
      return Heart;
    case "repost":
      return Repeat2;
    case "reply":
      return MessageCircle;
    default:
      return Bell;
  }
}

type NotificationGroup = {
  key: string;
  reason: string;
  notifications: SocialNotificationView[];
  contextUri?: string;
};

const contextualReasons = new Set(["like", "repost", "reply"]);

function groupNotifications(items: SocialNotificationView[]) {
  const groups: NotificationGroup[] = [];
  const grouped = new Map<string, NotificationGroup>();

  for (const notification of items) {
    const contextUri =
      notification.reason === "reply"
        ? notification.recordUri
        : notification.subjectUri;
    const canGroup = contextualReasons.has(notification.reason) && contextUri;
    const key = canGroup
      ? `${notification.reason}:${contextUri}`
      : `notification:${notification.id}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.notifications.push(notification);
      continue;
    }

    const group = {
      key,
      reason: notification.reason,
      notifications: [notification],
      contextUri,
    };
    grouped.set(key, group);
    groups.push(group);
  }

  return groups;
}

function compactTimeAgo(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

function reasonIconClass(reason: string) {
  switch (reason) {
    case "like":
      return "text-rose-500";
    case "repost":
      return "text-primary";
    case "reply":
      return "text-bsky";
    default:
      return "text-muted-foreground";
  }
}

function ActorAvatar({ notification }: { notification: SocialNotificationView }) {
  const actor = notification.actor;
  const actorDid = actor?.did || notification.actorDid;
  const label = displayActorName(actor, actorDid);
  const avatar = actorAvatarUrl(actor, actorDid);
  const href = actorProfileHref(actor, actorDid);

  return (
    <Link href={`/profile/${href}` as any} asChild>
      <Pressable
        className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-primary"
        accessibilityLabel={`View ${label}'s profile`}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} className="h-full w-full" />
        ) : (
          <Text className="text-sm font-black text-primary-foreground">
            {label.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </Pressable>
    </Link>
  );
}

function PostPreview({ post }: { post: SocialPostView }) {
  const play = trackViewToPlayView(post.track);
  const art = coverArtUrl(play.releaseMbId);

  return (
    <View className="rounded-lg border border-border bg-card/70 p-3">
      {post.text ? (
        <Text className="text-[15px] leading-6" numberOfLines={4}>
          {post.text}
        </Text>
      ) : (
        <Text className="text-sm italic text-muted-foreground">
          Shared a track
        </Text>
      )}
      <View className="mt-3 flex-row items-center gap-3 rounded-md bg-muted/55 p-2">
        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-accent">
          {art ? (
            <Image source={{ uri: art }} className="h-full w-full" />
          ) : (
            <Icon icon={Disc3} size={18} className="text-primary" />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-semibold" numberOfLines={1}>
            {play.trackName}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {displayArtists(play) || "Unknown artist"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function NotificationRow({ group }: { group: NotificationGroup }) {
  const notifications = group.notifications;
  const first = notifications[0];
  const IconForReason = reasonIcon(group.reason);
  const postHref = group.contextUri
    ? postHrefFromUri(group.contextUri)
    : undefined;
  const [postState, setPostState] = useState<{
    uri: string;
    post: SocialPostView | null;
  }>();
  const post =
    group.contextUri && contextualReasons.has(group.reason)
      ? postState?.uri === group.contextUri
        ? postState.post
        : undefined
      : null;

  useEffect(() => {
    if (!group.contextUri || !contextualReasons.has(group.reason)) return;

    let mounted = true;
    getSocialPost(group.contextUri)
      .then((response) => {
        if (mounted) {
          setPostState({ uri: group.contextUri!, post: response.post });
        }
      })
      .catch(() => {
        if (mounted) {
          setPostState({ uri: group.contextUri!, post: null });
        }
      });
    return () => {
      mounted = false;
    };
  }, [group.contextUri, group.reason]);

  const actorLabel = displayActorName(first.actor, first.actorDid);
  const otherCount = notifications.length - 1;

  return (
    <View className="border-b border-border py-5 first:pt-2">
      <View className="flex-row gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-accent">
          <Icon
            icon={IconForReason}
            size={20}
            className={reasonIconClass(group.reason)}
          />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-row items-center pl-1">
              {notifications.slice(0, 3).map((notification, index) => (
                <View
                  key={notification.id}
                  className={index > 0 ? "-ml-2" : undefined}
                  style={{ zIndex: 3 - index }}
                >
                  <ActorAvatar notification={notification} />
                </View>
              ))}
            </View>
            {postHref && (
              <Icon
                icon={ChevronRight}
                size={18}
                className="text-muted-foreground"
              />
            )}
          </View>
          <Text className="mt-3 text-[15px] leading-6">
            <Text className="font-black">{actorLabel}</Text>
            {otherCount > 0
              ? ` and ${otherCount} ${otherCount === 1 ? "other" : "others"}`
              : ""}{" "}
            {reasonLabel(group.reason)}
            <Text className="text-muted-foreground">
              {` · ${compactTimeAgo(first.createdAt)}`}
            </Text>
          </Text>

          {postHref && post === undefined && (
            <View className="mt-3 gap-2 rounded-lg border border-border bg-card/45 p-3">
              <View className="h-3 w-4/5 rounded-full bg-muted" />
              <View className="h-3 w-2/5 rounded-full bg-muted" />
            </View>
          )}
          {postHref && post && (
            <Link href={postHref as any} asChild>
              <Pressable
                className="mt-3 web:hover:opacity-80"
                accessibilityRole="link"
                accessibilityLabel="View the original post"
              >
                <PostPreview post={post} />
              </Pressable>
            </Link>
          )}
          {postHref && post === null && (
            <Text className="mt-3 text-sm italic text-muted-foreground">
              The original post is no longer available.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function Notifications() {
  const status = useStore((state) => state.status);
  const pdsAgent = useStore((state) => state.pdsAgent);
  const actorDid = pdsAgent?.did;
  const [items, setItems] = useState<SocialNotificationView[] | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    if (status !== "loggedIn" || !actorDid) {
      return;
    }
    setItems(null);
    setError(null);
    getNotifications(actorDid, 30)
      .then((res) => {
        if (!mounted) return;
        setItems(res.items);
        setCursor(res.cursor);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
        setItems([]);
      });
    return () => {
      mounted = false;
    };
  }, [actorDid, status]);

  const loadMore = useCallback(() => {
    if (!actorDid || !cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    getNotifications(actorDid, 30, cursor)
      .then((res) => {
        setItems((current) => {
          const knownIds = new Set(current?.map((item) => item.id) || []);
          return [
            ...(current || []),
            ...res.items.filter((item) => !knownIds.has(item.id)),
          ];
        });
        setCursor(res.cursor);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [actorDid, cursor]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const remaining =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (remaining < 600) loadMore();
    },
    [loadMore],
  );
  const groups = items ? groupNotifications(items) : [];

  if (status !== "loggedIn") {
    return (
      <TealShell rightRail={<RightRail />}>
        <Stack.Screen options={{ title: "Notifications", headerShown: false }} />
        <View className="min-h-[32rem] items-center justify-center gap-4 rounded-lg border border-border bg-card px-8">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
            <Icon icon={Bell} size={22} className="text-primary" />
          </View>
          <Text className="max-w-md text-center font-sans text-3xl font-black">
            Sign in to view notifications.
          </Text>
          <Text className="max-w-sm text-center text-sm leading-5 text-muted-foreground">
            Likes, reposts, replies, and playlist collaboration
            activity will appear here.
          </Text>
          <Link href="/auth/login" asChild>
            <Button>
              <Text>Sign In</Text>
            </Button>
          </Link>
        </View>
      </TealShell>
    );
  }

  return (
    <TealShell rightRail={<RightRail />} onScroll={handleScroll}>
      <Stack.Screen options={{ title: "Notifications", headerShown: false }} />
      <SectionHeading
        eyebrow="Social"
        title="Notifications"
      />
      {!items && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load notifications: {error}
          </Text>
        </View>
      )}
      {items?.length === 0 && !error && (
        <View className="min-h-[24rem] items-center justify-center rounded-lg border border-border bg-card p-8">
          <Text className="text-center text-2xl font-black">
            No notifications yet.
          </Text>
          <Text className="mt-2 text-center text-muted-foreground">
            Social activity indexed by Aqua will appear here.
          </Text>
        </View>
      )}
      <View className="mt-2">
        {groups.map((group) => (
          <NotificationRow key={group.key} group={group} />
        ))}
      </View>
      {loadingMore && (
        <View className="items-center justify-center py-5">
          <ActivityIndicator />
        </View>
      )}
    </TealShell>
  );
}
