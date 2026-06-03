import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import PlayFeedCard from "@/components/teal/PlayFeedCard";
import RightRail from "@/components/teal/RightRail";
import TealShell, {
  SectionHeading,
} from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { resolveHandle } from "@/lib/atp/pid";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  getActorFeed,
  getBlueskyProfile,
  getProfile,
  XrpcError,
} from "@/lib/teal/api";
import { useStore } from "@/stores/mainStore";
import type { AppBskyActorDefs } from "@atproto/api";
import { Info, UserRoundPlus } from "lucide-react-native";

import type { ProfileView } from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

type DisplayProfile = Pick<
  ProfileView,
  "displayName" | "description" | "avatar" | "banner"
> & {
  handle?: string;
};

function isHttpUrl(value?: string) {
  return value?.startsWith("http://") || value?.startsWith("https://");
}

function profileImageUrl(did: string, value?: string) {
  if (!value) return undefined;
  if (isHttpUrl(value) || value.startsWith("data:")) return value;
  return getImageCdnLink({ did, hash: value });
}

export default function ProfileScreen() {
  const { handle } = useLocalSearchParams();
  const actor = Array.isArray(handle) ? handle[0] : handle;
  const [did, setDid] = useState<string | null>(null);
  const [profile, setProfile] = useState<DisplayProfile | null>(null);
  const [plays, setPlays] = useState<PlayView[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [isBlueskyFallback, setIsBlueskyFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);
  const pdsAgent = useStore((state) => state.pdsAgent);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!actor) return;
      try {
        setError(null);
        setDid(null);
        setProfile(null);
        setPlays([]);
        setCursor(undefined);
        const resolved = actor.startsWith("did:")
          ? actor
          : await resolveHandle(actor);
        if (!mounted) return;
        setDid(resolved);
        const feedRes = await getActorFeed(resolved, 30);
        let nextProfile: DisplayProfile | null = null;
        let nextIsBlueskyFallback = false;

        try {
          nextProfile = (await getProfile(resolved)).profile;
        } catch (profileError) {
          if (
            !(profileError instanceof XrpcError) ||
            profileError.status !== 404
          ) {
            throw profileError;
          }

          const bskyProfile: AppBskyActorDefs.ProfileViewDetailed =
            await getBlueskyProfile(resolved);
          nextProfile = bskyProfile;
          nextIsBlueskyFallback = true;
        }

        if (!mounted) return;
        setProfile(nextProfile);
        setIsBlueskyFallback(nextIsBlueskyFallback);
        setPlays(feedRes.plays);
        setCursor(feedRes.cursor);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [actor]);

  const loadMore = useCallback(() => {
    if (!did || !cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    getActorFeed(did, 30, cursor)
      .then((feedRes) => {
        setPlays((current) => {
          const knownUris = new Set(current.map((play) => play.uri));
          return [
            ...current,
            ...feedRes.plays.filter(
              (play) => !play.uri || !knownUris.has(play.uri),
            ),
          ];
        });
        setCursor(feedRes.cursor);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [cursor, did]);

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

  const isSelf = did === pdsAgent?.did;
  const avatarUrl = did ? profileImageUrl(did, profile?.avatar) : undefined;
  const bannerUrl = did ? profileImageUrl(did, profile?.banner) : undefined;

  return (
    <TealShell rightRail={<RightRail />} onScroll={handleScroll}>
      <Stack.Screen
        options={{ title: actor || "Profile", headerShown: false }}
      />
      {!did && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load profile: {error}
          </Text>
        </View>
      )}
      {did && (
        <>
          <View className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
            <View className="h-40 bg-primary/30">
              {bannerUrl && (
                <Image
                  source={{ uri: bannerUrl }}
                  className="h-full w-full"
                />
              )}
            </View>
            <View className="-mt-12 px-6 pb-6">
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  className="h-24 w-24 rounded-lg border-4 border-background bg-primary"
                />
              ) : (
                <View className="h-24 w-24 items-center justify-center rounded-lg border-4 border-background bg-primary">
                  <Text className="text-4xl font-black text-primary-foreground">
                    {(profile?.displayName || actor || "T").slice(0, 1)}
                  </Text>
                </View>
              )}
              <Text className="mt-3 font-sans text-3xl font-black">
                {profile?.displayName || actor}
              </Text>
              {profile?.handle && (
                <Text className="font-mono text-sm text-muted-foreground">
                  @{profile.handle}
                </Text>
              )}
              <Text className="font-mono text-sm text-muted-foreground">
                {did}
              </Text>
              {isBlueskyFallback && (
                <View className="mt-4 flex-row gap-3 rounded-lg border border-bsky/30 bg-bsky/10 p-3">
                  <Icon icon={Info} size={18} className="mt-0.5 text-bsky" />
                  <View className="flex-1 gap-1">
                    <Text className="font-bold">Showing Bluesky profile</Text>
                    <Text className="text-sm text-muted-foreground">
                      This listener has not created a Teal profile yet. Their
                      Bluesky profile is shown as a fallback.
                    </Text>
                  </View>
                </View>
              )}
              {profile?.description && (
                <Text className="mt-4 text-lg">{profile.description}</Text>
              )}
              {isSelf && isBlueskyFallback && (
                <Link href="/onboarding" asChild>
                  <Button className="mt-5 flex-row gap-2 self-start">
                    <Icon icon={UserRoundPlus} size={18} />
                    <Text>Set up Teal profile</Text>
                  </Button>
                </Link>
              )}
            </View>
          </View>
          <SectionHeading eyebrow="Listening history" title="Recent plays" />
          {plays.length === 0 ? (
            <Text className="text-muted-foreground">No indexed plays yet.</Text>
          ) : (
            plays.map((play, index) => (
              <PlayFeedCard
                key={play.uri || `${play.trackName}-${index}`}
                play={play}
              />
            ))
          )}
          {loadingMore && (
            <View className="items-center justify-center py-5">
              <ActivityIndicator />
            </View>
          )}
          {plays.length > 0 && !cursor && (
            <Text className="pb-6 text-center font-mono text-xs text-muted-foreground">
              You reached the beginning of this listener's indexed plays.
            </Text>
          )}
        </>
      )}
    </TealShell>
  );
}
