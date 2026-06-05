import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Stack } from "expo-router";
import PlayFeedCard from "@/components/teal/PlayFeedCard";
import RightRail from "@/components/teal/RightRail";
import SocialComposer from "@/components/teal/SocialComposer";
import SocialPostCard from "@/components/teal/SocialPostCard";
import TealShell, {
  SectionHeading,
} from "@/components/teal/TealShell";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  getLatestPlays,
  getSocialFeed,
  type SocialPostView,
} from "@/lib/teal/api";
import { MessageCircle, Music2 } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

type HomeFeed = "posts" | "listens";

function HomeFeedTabButton({
  active,
  count,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  count: number;
  icon: typeof Music2;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-w-0 flex-1 flex-row items-center justify-center gap-2 border-b-2 px-2 py-3 ${
        active ? "border-foreground" : "border-transparent"
      }`}
    >
      <Icon
        icon={icon}
        size={17}
        className={active ? "text-foreground" : "text-muted-foreground"}
      />
      <Text
        className={
          active
            ? "text-sm font-black"
            : "text-sm font-bold text-muted-foreground"
        }
      >
        {label}
      </Text>
      <Text className="font-mono text-xs text-muted-foreground">{count}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [plays, setPlays] = useState<PlayView[] | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPostView[]>([]);
  const [activeFeed, setActiveFeed] = useState<HomeFeed>("posts");
  const [playCursor, setPlayCursor] = useState<string>();
  const [postCursor, setPostCursor] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getLatestPlays(30), getSocialFeed(30)])
      .then(([playRes, postRes]) => {
        if (!mounted) return;
        setPlays(playRes.plays);
        setPlayCursor(playRes.cursor);
        setSocialPosts(postRes.items);
        setPostCursor(postRes.cursor);
      })
      .catch((e) => {
        if (mounted) {
          setError(e instanceof Error ? e.message : String(e));
          setPlays([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const visiblePlays = plays || [];
  const activeItemsCount =
    activeFeed === "posts" ? socialPosts.length : visiblePlays.length;
  const activeCursor = activeFeed === "posts" ? postCursor : playCursor;

  const loadMore = useCallback(() => {
    const cursor = activeFeed === "posts" ? postCursor : playCursor;
    if (!cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const request =
      activeFeed === "posts"
        ? getSocialFeed(30, cursor)
        : getLatestPlays(30, cursor);
    request
      .then((res) => {
        if (activeFeed === "posts") {
          const postRes = res as Awaited<ReturnType<typeof getSocialFeed>>;
          setSocialPosts((current) => {
            const knownUris = new Set(current.map((post) => post.uri));
            return [
              ...current,
              ...postRes.items.filter((post) => !knownUris.has(post.uri)),
            ];
          });
          setPostCursor(postRes.cursor);
          return;
        }

        const playRes = res as Awaited<ReturnType<typeof getLatestPlays>>;
        setPlays((current) => {
          const knownUris = new Set(current?.map((play) => play.uri) || []);
          return [
            ...(current || []),
            ...playRes.plays.filter(
              (play) => !play.uri || !knownUris.has(play.uri),
            ),
          ];
        });
        setPlayCursor(playRes.cursor);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [activeFeed, playCursor, postCursor]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const remaining =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (remaining < 800) loadMore();
    },
    [loadMore],
  );

  return (
    <TealShell rightRail={<RightRail />} onScroll={handleScroll}>
      <Stack.Screen options={{ title: "Teal", headerShown: false }} />
      <SectionHeading
        eyebrow="Global feed"
        title="Posts and listens"
        detail="LIVE INDEX"
      />
      <View className="mb-6">
        <SocialComposer
          allowTrackChange
          onPublished={(post) => {
            setSocialPosts((current) => [post, ...current]);
            setActiveFeed("posts");
          }}
        />
      </View>
      <View className="mb-5 overflow-hidden rounded-lg border border-border bg-card">
        <View className="flex-row overflow-hidden">
          <HomeFeedTabButton
            active={activeFeed === "posts"}
            count={socialPosts.length}
            icon={MessageCircle}
            label="Posts"
            onPress={() => setActiveFeed("posts")}
          />
          <HomeFeedTabButton
            active={activeFeed === "listens"}
            count={visiblePlays.length}
            icon={Music2}
            label="Listens"
            onPress={() => setActiveFeed("listens")}
          />
        </View>
      </View>
      {!plays && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load the Teal play feed: {error}
          </Text>
        </View>
      )}
      {plays && activeItemsCount === 0 && !error && (
        <View className="min-h-[24rem] items-center justify-center rounded-lg border border-border bg-card p-8">
          <Text className="text-center text-2xl font-black">
            {activeFeed === "posts"
              ? "No posts indexed yet."
              : "No listens indexed yet."}
          </Text>
          <Text className="mt-2 text-center text-muted-foreground">
            Cadet will fill this view as ATProto records arrive.
          </Text>
        </View>
      )}
      {activeFeed === "posts" &&
        socialPosts.map((post) => (
          <View key={post.uri} className="mb-4">
            <SocialPostCard post={post} />
          </View>
        ))}
      {activeFeed === "listens" &&
        visiblePlays.map((play, index) => (
          <PlayFeedCard
            key={play.uri || `${play.trackName}-${play.playedTime}-${index}`}
            play={play}
          />
        ))}
      {loadingMore && (
        <View className="items-center justify-center py-5">
          <ActivityIndicator />
        </View>
      )}
      {plays && activeItemsCount > 0 && !activeCursor && (
        <Text className="pb-6 text-center font-mono text-xs text-muted-foreground">
          You reached the beginning of this feed.
        </Text>
      )}
    </TealShell>
  );
}
