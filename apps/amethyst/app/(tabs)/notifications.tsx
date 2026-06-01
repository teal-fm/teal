import { View } from "react-native";
import { Link, Stack } from "expo-router";
import RightRail from "@/components/songish/RightRail";
import SongishShell from "@/components/songish/SongishShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import { Bell } from "lucide-react-native";

export default function Notifications() {
  const status = useStore((state) => state.status);

  return (
    <SongishShell rightRail={<RightRail />}>
      <Stack.Screen options={{ title: "Notifications", headerShown: false }} />
      <View className="min-h-[32rem] items-center justify-center gap-4 rounded-lg border border-border bg-card px-8">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
          <Icon icon={Bell} size={22} className="text-primary" />
        </View>
        <Text className="max-w-md text-center font-serif text-3xl font-black">
          {status === "loggedIn"
            ? "Notifications are coming later."
            : "You must be signed in to view your notifications."}
        </Text>
        <Text className="max-w-sm text-center text-sm leading-5 text-muted-foreground">
          Teal is focused on the listening graph first. Social notifications
          will arrive with the next lexicon pass.
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
