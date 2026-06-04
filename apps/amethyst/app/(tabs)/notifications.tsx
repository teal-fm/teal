import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  getNotifications,
  type SocialNotificationView,
} from "@/lib/teal/api";
import { timeAgo } from "@/lib/utils";
import { useStore } from "@/stores/mainStore";
import { BadgeCheck, Bell, Heart, MessageCircle, Repeat2 } from "lucide-react-native";

function reasonLabel(reason: string) {
  switch (reason) {
    case "like":
      return "liked your post";
    case "repost":
      return "reposted your post";
    case "reply":
      return "replied to your post";
    case "badgeAssignment":
      return "assigned you a badge";
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
    case "badgeAssignment":
      return BadgeCheck;
    default:
      return Bell;
  }
}

function NotificationRow({ notification }: { notification: SocialNotificationView }) {
  const actor = notification.actor;
  const actorLabel =
    actor?.displayName || actor?.handle || notification.actorDid || "Someone";
  const actorHref = actor?.handle || notification.actorDid;
  const IconForReason = reasonIcon(notification.reason);

  return (
    <View className="rounded-lg border border-border bg-card p-4">
      <View className="flex-row gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-accent">
          <Icon icon={IconForReason} size={18} className="text-primary" />
        </View>
        <View className="min-w-0 flex-1">
          <Link href={`/profile/${actorHref}` as any} asChild>
            <Pressable>
              <Text className="font-black" numberOfLines={1}>
                {actorLabel}
              </Text>
            </Pressable>
          </Link>
          <Text className="text-sm text-muted-foreground">
            {reasonLabel(notification.reason)}
          </Text>
          <Text className="mt-2 font-mono text-[10px] uppercase text-muted-foreground">
            {timeAgo(new Date(notification.createdAt))}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function Notifications() {
  const status = useStore((state) => state.status);
  const pdsAgent = useStore((state) => state.pdsAgent);
  const [items, setItems] = useState<SocialNotificationView[] | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    if (status !== "loggedIn" || !pdsAgent?.did) {
      setItems([]);
      setCursor(undefined);
      return;
    }
    setItems(null);
    setError(null);
    getNotifications(pdsAgent.did, 30)
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
  }, [pdsAgent?.did, status]);

  const loadMore = useCallback(() => {
    if (!pdsAgent?.did || !cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    getNotifications(pdsAgent.did, 30, cursor)
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
  }, [cursor, pdsAgent?.did]);

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
            Likes, reposts, replies, badge assignments, and playlist collaboration
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
        detail="LIVE INDEX"
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
      <View className="gap-3">
        {items?.map((notification) => (
          <NotificationRow key={notification.id} notification={notification} />
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
