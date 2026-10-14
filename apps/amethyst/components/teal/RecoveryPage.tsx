import { View } from "react-native";
import { Link, router, Stack } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { AlertCircle } from "lucide-react-native";

import TealShell from "./TealShell";

export default function RecoveryPage({
  title,
  description,
  icon = AlertCircle,
  retry = false,
}: {
  title: string;
  description: string;
  icon?: typeof AlertCircle;
  retry?: boolean;
}) {
  return (
    <TealShell pageTitle={title}>
      <Stack.Screen options={{ title, headerShown: false }} />
      <View className="min-h-[26rem] items-center justify-center gap-5 py-12">
        <Icon icon={icon} size={40} className="text-muted-foreground" />
        <Text
          role="heading"
          aria-level={1}
          className="text-center text-3xl font-semibold"
        >
          {title}
        </Text>
        <Text className="max-w-md text-center leading-6 text-muted-foreground">
          {description}
        </Text>
        <View className="flex-row flex-wrap justify-center gap-3">
          {retry && (
            <Button
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
            >
              <Text>Go back</Text>
            </Button>
          )}
          <Link href="/" asChild>
            <Button variant={retry ? "outline" : "default"}>
              <Text>Back to Home</Text>
            </Button>
          </Link>
          {!retry && (
            <Link href="/search" asChild>
              <Button variant="outline">
                <Text>Explore music</Text>
              </Button>
            </Link>
          )}
        </View>
      </View>
    </TealShell>
  );
}
