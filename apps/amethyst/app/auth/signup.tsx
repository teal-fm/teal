import React from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons/iconWithClassName";
import { ArrowRight, AtSignIcon } from "lucide-react-native";

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
      <View className="flex-1 justify-center p-8 gap-4 pb-32 w-screen max-w-md">
        <Text className="text-3xl text-center text-foreground -mb-2">
          Sign up via{" "}
          <Icon
            icon={AtSignIcon}
            className="color-bsky inline mb-2"
            size={32}
          />{" "}
          ATProto
        </Text>
        <Text className="text-foreground text-xl text-center">
          No account? No problem.
        </Text>
        <View className="flex flex-col justify-center items-center">
          <Text className="mb-2 text-center -mx-3">
            To use teal.fm, you’ll need a PDS—your personal data storage on the
            AT Protocol. Signing up with Bluesky is a great way to begin.
          </Text>
          <Text className="text-center mb-4 text-xs text-muted-foreground">
            Sign up with Bluesky, then return here to start exploring.
          </Text>
          {/* on click, open tab, then in the background navigate to /login */}
          <Button
            onPress={() => {
              // on web, open new tab
              if (Platform.OS === "web") {
                window.open("https://bsky.app/signup", "_blank");
              } else {
                router.navigate("https://bsky.app");
              }
              setTimeout(() => {
                router.replace("/auth/login");
              }, 1000);
            }}
            className="flex flex-row justify-center items-center gap-2 bg-bsky"
          >
            <Text className="text-sm ml-2 text-secondary">To Bluesky</Text>
            <Icon icon={ArrowRight} />
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
