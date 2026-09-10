import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Stack } from "expo-router";
import CreateSocialPostModal from "@/components/teal/CreateSocialPostModal";
import PlayFeedCard from "@/components/teal/PlayFeedCard";
import RightRail from "@/components/teal/RightRail";
import SocialComposer from "@/components/teal/SocialComposer";
import SocialPostCard from "@/components/teal/SocialPostCard";
import TealShell, {
  SectionHeading,
} from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  displayArtists,
  getLatestPlays,
  getProfile,
  getSocialFeed,
  type SocialPostView,
} from "@/lib/teal/api";
import { useStore } from "@/stores/mainStore";
import { Plus } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

export default function HomeScreen() {
  const [plays, setPlays] = useState<PlayView[] | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPostView[]>([]);
  const [currentStatus, setCurrentStatus] = useState<PlayView | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const loadingMoreRef = useRef(false);
  const pdsAgent = useStore((state) => state.pdsAgent);

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

  useEffect(() => {
    let mounted = true;
    if (!pdsAgent?.did) {
      setCurrentStatus(null);
      return;
    }
    getProfile(pdsAgent.did)
      .then((res) => {
        if (mounted) setCurrentStatus(res.profile.status?.item || null);
      })
      .catch(() => {
        if (mounted) setCurrentStatus(null);
      });
    return () => {
      mounted = false;
    };
  }, [pdsAgent?.did]);

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
      <View className="mb-6 rounded-lg border border-border bg-card p-4">
        <View className="flex-row items-center justify-between gap-4">
          <View className="min-w-0 flex-1">
            <Text className="font-mono text-[10px] uppercase text-primary">
              Teal social
            </Text>
            <Text className="mt-1 text-lg font-black">Post about any song</Text>
            <Text className="text-sm text-muted-foreground">
              Attach a MusicBrainz result or one of your indexed recent plays.
            </Text>
          </View>
          <Button
            className="shrink-0 flex-row gap-2"
            onPress={() => setCreatePostOpen(true)}
          >
            <Icon icon={Plus} size={17} className="text-primary-foreground" />
            <Text>Create post</Text>
          </Button>
        </View>
      </View>
      <CreateSocialPostModal
        visible={createPostOpen}
        onClose={() => setCreatePostOpen(false)}
        onPublished={(post) => setSocialPosts((current) => [post, ...current])}
      />
      {currentStatus && (
        <View className="mb-6 gap-3">
          <View className="rounded-lg border border-primary/25 bg-primary/10 p-4">
            <Text className="font-mono text-[10px] uppercase text-primary">
              Your current listening status
            </Text>
            <Text className="mt-1 font-sans text-2xl font-black">
              {currentStatus.trackName}
            </Text>
            <Text className="text-sm font-bold text-muted-foreground">
              {displayArtists(currentStatus) || "Unknown artist"}
            </Text>
          </View>
          <SocialComposer
            track={currentStatus}
            onPublished={(post) =>
              setSocialPosts((current) => [post, ...current])
            }
          />
        </View>
      )}
      {pdsAgent?.did && !currentStatus && (
        <View className="mb-6 rounded-lg border border-border bg-card p-4">
          <Text className="font-mono text-[10px] uppercase text-muted-foreground">
            Your current listening status
          </Text>
          <Text className="mt-1 font-bold">No active status</Text>
          <Text className="text-sm text-muted-foreground">
            Statuses expire automatically when their Teal record expires or no
            current-listening record has been indexed yet.
          </Text>
        </View>
      )}
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
