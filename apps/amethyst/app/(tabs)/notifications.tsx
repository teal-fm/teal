import { View } from "react-native";
import { Link, Stack } from "expo-router";
import RightRail from "@/components/songish/RightRail";
import SongishShell from "@/components/songish/SongishShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useStore } from "@/stores/mainStore";

export default function Notifications() {
  const status = useStore((state) => state.status);

  return (
    <SongishShell rightRail={<RightRail />}>
      <Stack.Screen options={{ title: "Notifications", headerShown: false }} />
      <View className="min-h-[24rem] items-center justify-center gap-4">
        <Text className="max-w-md text-center text-3xl font-black">
          {status === "loggedIn"
            ? "Notifications are coming later."
            : "You must be signed in to view your notifications."}
        </Text>
        {status !== "loggedIn" && (
          <Link href="/auth/login" asChild>
            <Button>
              <Text>Sign In</Text>
            </Button>
          </Link>
        )}
      </View>
    </SongishShell>
  );
}
