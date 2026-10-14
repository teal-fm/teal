import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Link, router, Stack } from "expo-router";
import { useLocalSearchParams } from "expo-router/build/hooks";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import { PencilLine } from "lucide-react-native";

const toSearchParams = (
  params: Record<string, string | string[] | undefined>,
): URLSearchParams => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item);
      }
    } else if (value !== undefined) {
      searchParams.set(key, value);
    }
  }
  return searchParams;
};

export default function AuthOptions() {
  const status = useStore((state) => state.status);
  const params = useLocalSearchParams<"iss" | "state" | "code">();
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    // The OAuth state in IndexedDB is deleted on first read (replay prevention).
    // Must only call oauthCallback once -- a second call will fail with
    // "Unknown authorization session".
    if (calledRef.current || !params) return;
    calledRef.current = true;
    const searchParams = toSearchParams(params);
    useStore
      .getState()
      .oauthCallback(searchParams)
      .then(() => {
        // The store reports callback failures in state rather than rejecting.
        const result = useStore.getState();
        if (result.status !== "loggedIn" || !result.pdsAgent) {
          setError(result.login.error || "Sign-in did not complete.");
          return;
        }
        // A previous failed attempt can leave login.error behind. The current
        // authenticated status is authoritative after this callback completes.
        setError(null);
        router.replace("/");
      })
      .catch(() => setError("Sign-in did not complete."));
  }, [params]);

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
      <Text
        accessibilityRole={error ? "alert" : "header"}
        className="text-center text-3xl font-semibold text-foreground"
      >
        {error
          ? "Couldn't finish signing in"
          : status === "loggedIn"
            ? "You're signed in"
            : "Finishing sign-in..."}
      </Text>
      <Text className="text-center text-sm text-muted-foreground">
        {error
          ? "Your sign-in session may have expired. Start again to connect your account."
          : "Connecting your account to Teal. This may take a few seconds."}
      </Text>
      {error && (
        <Link href="/auth/login" asChild>
          <Button>
            <Text>Try signing in again</Text>
          </Button>
        </Link>
      )}
    </View>
  );
}
