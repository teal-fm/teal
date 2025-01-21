import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons/iconWithClassName";
import { ArrowRight } from "lucide-react-native";

import { Stack, router } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";

const LoginScreen = () => {
  return (
    <SafeAreaView className="flex-1 flex justify-center items-center">
      <Stack.Screen
        options={{
          title: "Sign in",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="flex-1 justify-center p-8 gap-4 pb-32 w-screen max-w-screen-md">
        <Text className="text-4xl font-semibold text-center text-foreground">
          Sign up with{" "}
          <Icon
            icon={FontAwesome6}
            className="color-bsky"
            name="bluesky"
            size={28}
          />{" "}
          Bluesky
        </Text>
        <View className="flex flex-col justify-center items-center">
          <Text className="text-foreground text-lg">
            No account? That's fine.
          </Text>
          <Text className="text-foreground mb-4 text-center text-lg">
            Sign up for Bluesky, then return here to sign in.
          </Text>
          {/* on click, open tab, then in the background navigate to /login */}
          <Button
            onPress={() => {
              // on web, open new tab
              if (typeof window !== "undefined") {
                window.open("https://bsky.app/signup", "_blank");
              } else {
                router.navigate("https://bsky.app");
              }
              setTimeout(() => {
                router.replace("/auth/login");
              }, 1000);
            }}
            className="flex flex-row justify-center items-center gap-2"
          >
            <Text className="text-sm ml-2 text-secondary">Go</Text>
            <Icon icon={ArrowRight} />
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
