import { useCallback, useEffect, useRef, useState } from "react";
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

export default function HomeScreen() {
  const [plays, setPlays] = useState<PlayView[] | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPostView[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    getLatestPlays(30)
      .then((res) => {
        if (!mounted) return;
        setPlays(res.plays);
        setCursor(res.cursor);
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

  useEffect(() => {
    let mounted = true;
    getSocialFeed(10)
      .then((res) => {
        if (mounted) setSocialPosts(res.items);
      })
      .catch(() => {
        if (mounted) setSocialPosts([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    getLatestPlays(30, cursor)
      .then((res) => {
        setPlays((current) => {
          const knownUris = new Set(current?.map((play) => play.uri) || []);
          return [
            ...(current || []),
            ...res.plays.filter(
              (play) => !play.uri || !knownUris.has(play.uri),
            ),
          ];
        });
        setCursor(res.cursor);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [cursor]);

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
        title="Recently listened"
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
      {socialPosts.length > 0 && (
        <View className="mb-8 gap-3">
          <SectionHeading
            eyebrow="Social feed"
            title="Posts with tracks"
            detail="NEW LEXICONS"
          />
          {socialPosts.map((post) => (
            <SocialPostCard key={post.uri} post={post} />
          ))}
        </View>
      )}
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
      {plays?.length === 0 && !error && (
        <View className="min-h-[24rem] items-center justify-center rounded-lg border border-border bg-card p-8">
          <Text className="text-center text-2xl font-black">
            No plays indexed yet.
          </Text>
          <Text className="mt-2 text-center text-muted-foreground">
            Cadet will fill this feed as ATProto firehose records arrive.
          </Text>
        </View>
      )}
      {plays?.map((play, index) => (
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
      {plays && plays.length > 0 && !cursor && (
        <Text className="pb-6 text-center font-mono text-xs text-muted-foreground">
          You reached the beginning of the indexed feed.
        </Text>
      )}
    </TealShell>
  );
}
