import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import {
  getLatestPlays,
  getSocialFeed,
  type SocialPostView,
} from "@/lib/teal/api";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

type FeedPlayView = PlayView & {
  createdAt?: string;
};

export default function HomeScreen() {
  const [plays, setPlays] = useState<PlayView[] | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPostView[]>([]);
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

  const feedItems = useMemo(() => {
    const playItems =
      plays?.map((play, index) => ({
        type: "play" as const,
        key: play.uri || `${play.trackName}-${play.playedTime}-${index}`,
        sortTime: feedDate(play.playedTime, (play as FeedPlayView).createdAt),
        play,
      })) || [];
    const postItems = socialPosts.map((post) => ({
      type: "post" as const,
      key: post.uri,
      sortTime: feedDate(post.createdAt),
      post,
    }));

    return [...playItems, ...postItems].sort((a, b) => b.sortTime - a.sortTime);
  }, [plays, socialPosts]);

  const loadMore = useCallback(() => {
    if ((!playCursor && !postCursor) || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    Promise.all([
      playCursor
        ? getLatestPlays(30, playCursor)
        : Promise.resolve({ plays: [] as PlayView[], cursor: undefined }),
      postCursor
        ? getSocialFeed(30, postCursor)
        : Promise.resolve({
            items: [] as SocialPostView[],
            cursor: undefined,
          }),
    ])
      .then(([playRes, postRes]) => {
        if (playCursor) {
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
        }
        if (postCursor) {
          setSocialPosts((current) => {
            const knownUris = new Set(current.map((post) => post.uri));
            return [
              ...current,
              ...postRes.items.filter((post) => !knownUris.has(post.uri)),
            ];
          });
          setPostCursor(postRes.cursor);
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [playCursor, postCursor]);

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
        title="New listens and posts"
        detail="LIVE INDEX"
      />
      <View className="mb-6">
        <SocialComposer
          allowTrackChange
          onPublished={(post) =>
            setSocialPosts((current) => [post, ...current])
          }
        />
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
      {plays && feedItems.length === 0 && !error && (
        <View className="min-h-[24rem] items-center justify-center rounded-lg border border-border bg-card p-8">
          <Text className="text-center text-2xl font-black">
            No feed activity indexed yet.
          </Text>
          <Text className="mt-2 text-center text-muted-foreground">
            Cadet will fill this feed as ATProto records arrive.
          </Text>
        </View>
      )}
      {feedItems.map((item) =>
        item.type === "play" ? (
          <PlayFeedCard key={item.key} play={item.play} />
        ) : (
          <View key={item.key} className="mb-4">
            <SocialPostCard post={item.post} />
          </View>
        ),
      )}
      {loadingMore && (
        <View className="items-center justify-center py-5">
          <ActivityIndicator />
        </View>
      )}
      {plays && feedItems.length > 0 && !playCursor && !postCursor && (
        <Text className="pb-6 text-center font-mono text-xs text-muted-foreground">
          You reached the beginning of the indexed feed.
        </Text>
      )}
    </TealShell>
  );
}

function feedDate(...dates: Array<string | undefined>) {
  for (const date of dates) {
    if (!date) continue;
    const timestamp = new Date(date).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}
