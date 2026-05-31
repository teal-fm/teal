import { Stack } from "expo-router";
import RightRail from "@/components/songish/RightRail";
import SongishShell from "@/components/songish/SongishShell";
import { Text } from "@/components/ui/text";

export default function Explore() {
  return (
    <SongishShell title="Explore" rightRail={<RightRail />}>
      <Stack.Screen options={{ title: "Explore", headerShown: false }} />
      <Text className="mb-6 text-2xl font-black">Events</Text>
      <Text className="text-center text-lg text-muted-foreground">
        No events at the moment.
      </Text>
    </SongishShell>
  );
}
