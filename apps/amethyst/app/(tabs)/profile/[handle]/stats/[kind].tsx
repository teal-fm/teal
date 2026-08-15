import { Stack, useLocalSearchParams } from "expo-router";
import RightRail from "@/components/teal/RightRail";
import TealShell from "@/components/teal/TealShell";
import {
  ProfileStatsMorePage,
  type ProfileStatsKind,
} from "@/components/teal/ProfileStats";
import { Text } from "@/components/ui/text";
import { View } from "react-native";

function normalizeKind(value?: string): ProfileStatsKind | undefined {
  if (value === "artists" || value === "albums" || value === "tracks") {
    return value;
  }
  return undefined;
}

export default function ProfileStatsRoute() {
  const params = useLocalSearchParams();
  const actor = Array.isArray(params.handle) ? params.handle[0] : params.handle;
  const kindParam = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const period = Array.isArray(params.period) ? params.period[0] : params.period;
  const kind = normalizeKind(kindParam);

  return (
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen options={{ title: "Profile stats", headerShown: false }} />
      {!actor || !kind ? (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load profile stats.
          </Text>
        </View>
      ) : (
        <ProfileStatsMorePage
          actor={actor}
          kind={kind}
          initialPeriod={period}
        />
      )}
    </TealShell>
  );
}
