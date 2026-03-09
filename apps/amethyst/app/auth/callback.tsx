import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { Link, router, Stack } from "expo-router";
import { useLocalSearchParams } from "expo-router/build/hooks";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import { PencilLine } from "lucide-react-native";

export default function AuthOptions() {
  const status = useStore((state) => state.status);
  const params = useLocalSearchParams<"iss" | "state" | "code">();
  const { state } = params;
  const calledRef = useRef(false);

  useEffect(() => {
    // The OAuth state in IndexedDB is deleted on first read (replay prevention).
    // Must only call oauthCallback once -- a second call will fail with
    // "Unknown authorization session".
    if (calledRef.current || !params) return;
    calledRef.current = true;
    const searchParams = new URLSearchParams(params);
    useStore.getState().oauthCallback(searchParams);
  }, [params]);

  useEffect(() => {
    if (status === "loggedIn") {
      requestAnimationFrame(() => {
        router.replace("/");
      });
    }
  }, [status]);

  if (!params) {
    return (
      <View>
        <Link href="/error" />
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
      <Text className="rounded-full bg-muted-foreground/30 px-2 py-1 font-mono text-sm text-muted-foreground">
        {state}
      </Text>
    </View>
  );
}
