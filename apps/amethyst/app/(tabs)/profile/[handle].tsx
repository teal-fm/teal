import { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import PlayFeedCard from "@/components/songish/PlayFeedCard";
import RightRail from "@/components/songish/RightRail";
import SongishShell from "@/components/songish/SongishShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { resolveHandle } from "@/lib/atp/pid";
import {
  getActorFeed,
  getBlueskyProfile,
  getProfile,
  XrpcError,
} from "@/lib/teal/api";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import type { AppBskyActorDefs } from "@atproto/api";
import type { ProfileView } from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";
import { Info, Music2, UserRoundPlus } from "lucide-react-native";

type DisplayProfile = Pick<
  ProfileView,
  "displayName" | "description" | "avatar" | "banner"
> & {
  handle?: string;
};

function isHttpUrl(value?: string) {
  return value?.startsWith("http://") || value?.startsWith("https://");
}

export default function ProfileScreen() {
  const { handle } = useLocalSearchParams();
  const actor = Array.isArray(handle) ? handle[0] : handle;
  const [did, setDid] = useState<string | null>(null);
  const [profile, setProfile] = useState<DisplayProfile | null>(null);
  const [plays, setPlays] = useState<PlayView[]>([]);
  const [isBlueskyFallback, setIsBlueskyFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdsAgent = useStore((state) => state.pdsAgent);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!actor) return;
      try {
        const resolved = actor.startsWith("did:") ? actor : await resolveHandle(actor);
        if (!mounted) return;
        setDid(resolved);
        const feedRes = await getActorFeed(resolved, 50);
        let nextProfile: DisplayProfile | null = null;
        let nextIsBlueskyFallback = false;

        try {
          nextProfile = (await getProfile(resolved)).profile;
        } catch (profileError) {
          if (!(profileError instanceof XrpcError) || profileError.status !== 404) {
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
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [actor]);

  const isSelf = did === pdsAgent?.did;

  return (
    <SongishShell rightRail={<RightRail />}>
      <Stack.Screen options={{ title: actor || "Profile", headerShown: false }} />
      {!did && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="rounded-2xl bg-destructive/15 p-4">
          <Text className="font-bold text-destructive">Could not load profile: {error}</Text>
        </View>
      )}
      {did && (
        <>
          <View className="mb-8 overflow-hidden rounded-3xl bg-background/70">
            <View className="h-40 bg-primary/30">
              {profile?.banner && isHttpUrl(profile.banner) && (
                <Image source={{ uri: profile.banner }} className="h-full w-full" />
              )}
            </View>
            <View className="-mt-12 px-6 pb-6">
              {profile?.avatar && isHttpUrl(profile.avatar) ? (
                <Image
                  source={{ uri: profile.avatar }}
                  className="h-24 w-24 rounded-2xl border-4 border-background bg-primary"
                />
              ) : (
                <View className="h-24 w-24 items-center justify-center rounded-2xl border-4 border-background bg-primary">
                  <Text className="text-4xl font-black text-primary-foreground">
                    {(profile?.displayName || actor || "T").slice(0, 1)}
                  </Text>
                </View>
              )}
              <Text className="mt-3 font-serif text-4xl font-black">
                {profile?.displayName || actor}
              </Text>
              {profile?.handle && (
                <Text className="font-mono text-sm text-muted-foreground">
                  @{profile.handle}
                </Text>
              )}
              <Text className="font-mono text-sm text-muted-foreground">{did}</Text>
              {isBlueskyFallback && (
                <View className="mt-4 flex-row gap-3 rounded-xl border border-bsky/30 bg-bsky/10 p-3">
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
          <View className="mb-4 flex-row items-center gap-2">
            <Icon icon={Music2} size={20} />
            <Text className="text-2xl font-black">Plays</Text>
          </View>
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
        </>
      )}
    </SongishShell>
  );
}
