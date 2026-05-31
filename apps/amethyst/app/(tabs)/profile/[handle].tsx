import { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import PlayFeedCard from "@/components/songish/PlayFeedCard";
import RightRail from "@/components/songish/RightRail";
import SongishShell from "@/components/songish/SongishShell";
import { Text } from "@/components/ui/text";
import { resolveHandle } from "@/lib/atp/pid";
import { getActorFeed, getProfile } from "@/lib/teal/api";
import type { ProfileView } from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

export default function ProfileScreen() {
  const { handle } = useLocalSearchParams();
  const actor = Array.isArray(handle) ? handle[0] : handle;
  const [did, setDid] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [plays, setPlays] = useState<PlayView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!actor) return;
      try {
        const resolved = actor.startsWith("did:") ? actor : await resolveHandle(actor);
        if (!mounted) return;
        setDid(resolved);
        const [profileRes, feedRes] = await Promise.all([
          getProfile(resolved),
          getActorFeed(resolved, 50),
        ]);
        if (!mounted) return;
        setProfile(profileRes.profile);
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
              {profile?.banner && (
                <Image source={{ uri: profile.banner }} className="h-full w-full" />
              )}
            </View>
            <View className="-mt-12 px-6 pb-6">
              <View className="h-24 w-24 items-center justify-center rounded-2xl border-4 border-background bg-primary">
                <Text className="text-4xl font-black text-primary-foreground">
                  {(profile?.displayName || actor || "T").slice(0, 1)}
                </Text>
              </View>
              <Text className="mt-3 font-serif text-4xl font-black">
                {profile?.displayName || actor}
              </Text>
              <Text className="font-mono text-sm text-muted-foreground">{did}</Text>
              {profile?.description && (
                <Text className="mt-4 text-lg">{profile.description}</Text>
              )}
            </View>
          </View>
          <Text className="mb-4 text-2xl font-black">Plays</Text>
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
