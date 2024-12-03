import { Link, Stack, router } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import React, { useEffect } from "react";
import { Icon } from "@/lib/icons/iconWithClassName";
import { PencilLine } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router/build/hooks";
import { useStore } from "@/stores/mainStore";

export default function AuthOptions() {
  const authCode = useStore((state) => state.authCode);
  const setJwt = useStore((state) => state.setJwt);

  useEffect(() => {
    if (authCode) {
      // exchange the code for tokens
      fetch(
        (process.env.EXPO_PUBLIC_API_BASE_URL ?? "0.0.0.0:3000") +
          "/oauth/callback/app?state=" +
          encodeURIComponent(authCode),
      )
        .then((res) => res.json())
        .then((res) => {
          console.log("res:", res);

          setJwt(JSON.parse(res));

          // wait half a second
          setTimeout(() => {
            router.replace("/");
          }, 500);
        })
        .catch((err) => {
          console.error("Error:", err);
        });
    }
  }, []);
  // if no state then redirect to error page
  if (!authCode) {
    return (
      <View>
        <Link href="/error" />
      </View>
    );
  }
  const state = decodeURIComponent(authCode);
  console.log("state:", state);
  const firstTwoParts = state.split("+")[0].split(":");
  const uuid = firstTwoParts.pop();
  return (
    <View className="flex-1 justify-center items-center gap-5 p-6 bg-background">
      <Stack.Screen
        options={{
          title: "Processing",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Icon icon={PencilLine} size={64} />
      <Text className="text-3xl font-semibold text-center text-foreground">
        Fetching your data...
      </Text>
      <Text className="text-sm text-muted-foreground">
        This may take a few seconds
      </Text>
      <Text className="text-sm text-muted-foreground">{uuid}</Text>
    </View>
  );
}
