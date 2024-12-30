import { Link, Stack, router } from "expo-router";
import { View } from "react-native";
import { Text } from "../../components/ui/text";
import React, { useEffect } from "react";
import { Icon } from "../../lib/icons/iconWithClassName";
import { PencilLine } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router/build/hooks";
import { useStore } from "../../stores/mainStore";

interface CallbackSearchParams {
  iss: string;
  state: string;
  code: string;
}

export default function AuthOptions() {
  const { oauthCallback, status } = useStore((state) => state);

  const params = useLocalSearchParams<'iss' | 'state' | 'code'>();
  const {state} = params;
  useEffect(() => {
      // exchange the tokens for jwt
      const searchParams = new URLSearchParams(params);
      oauthCallback(searchParams);
  }, []);

  useEffect(() => {
    if (status === "loggedIn") {
      router.replace("/");
    }
  }, [state])
  // if no state then redirect to error page
  if (!params) {
    return (
      <View>
        <Link href="/error" />
      </View>
    );
  }
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
        {status === "loggedIn" ? "Success!" : "Fetching your data..."}
      </Text>
      <Text className="text-sm text-muted-foreground">
        This may take a few seconds {status} 
      </Text>
      <Text className="text-sm text-muted-foreground font-mono bg-muted-foreground/30 py-1 px-2 rounded-full">{state}</Text>
    </View>
  );
}
