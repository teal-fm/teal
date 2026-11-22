import React, { useEffect } from "react";
import { View } from "react-native";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useOAuthCallback } from "@/lib/atp/useOAuthCallback";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import { PencilLine } from "lucide-react-native";

export default function AuthCallback() {
  const status = useStore((state) => state.status);
  const complete = useStore((state) => state.oauthCallback);
  const loginError = useStore((state) => state.login.error);
  const params = useLocalSearchParams();
  useOAuthCallback(params, complete);
  const providerError = params.error !== undefined;

  useEffect(() => {
    if (status === "loggedIn" && !providerError) {
      const frame = requestAnimationFrame(() => router.replace("/"));
      return () => cancelAnimationFrame(frame);
    }
  }, [status, providerError]);

  if (providerError || (status === "loggedOut" && loginError)) {
    return (
      <View>
        <Text accessibilityRole="alert">Sign-in did not complete.</Text>
        <Link href="/auth/login">Try signing in again</Link>
      </View>
    );
  }
  return (
    <View className="flex-1 items-center justify-center gap-5 bg-background p-6">
      <Stack.Screen
        options={{
          title: "Processing",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Icon icon={PencilLine} size={64} />
      <Text className="text-center text-3xl font-semibold text-foreground">
        {status === "loggedIn" ? "Success!" : "Fetching your data..."}
      </Text>
      <Text className="text-sm text-muted-foreground">
        This may take a few seconds {status}
      </Text>
    </View>
  );
}
