import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import PlayFeedCard from "@/components/songish/PlayFeedCard";
import RightRail from "@/components/songish/RightRail";
import SongishShell from "@/components/songish/SongishShell";
import { Text } from "@/components/ui/text";
import { getLatestPlays } from "@/lib/teal/api";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

export default function HomeScreen() {
  const [plays, setPlays] = useState<PlayView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getLatestPlays(50)
      .then((res) => {
        if (mounted) setPlays(res.plays);
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

  return (
    <SongishShell rightRail={<RightRail />}>
      <Stack.Screen options={{ title: "Teal", headerShown: false }} />
      {!plays && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="mb-6 rounded-2xl bg-destructive/15 p-4">
          <Text className="font-bold text-destructive">
            Could not load the Teal play feed: {error}
          </Text>
        </View>
      )}
      {plays?.length === 0 && !error && (
        <View className="min-h-[24rem] items-center justify-center rounded-2xl bg-background/70 p-8">
          <Text className="text-center text-2xl font-black">No plays indexed yet.</Text>
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
    </SongishShell>
  );
}
