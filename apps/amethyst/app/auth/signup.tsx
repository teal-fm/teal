import React from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { ArrowRight, AtSignIcon } from "lucide-react-native";

const LoginScreen = () => {
  return (
    <SafeAreaView className="flex flex-1 items-center justify-center">
      <Stack.Screen
        options={{
          title: "Sign in",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="w-screen max-w-md flex-1 items-center justify-center gap-4 p-8 pb-32">
        <Icon icon={AtSignIcon} className="mb-2 mr-1.5 color-bsky" size={48} />
        <Text className="-mb-2 text-center text-3xl text-foreground">
          Sign up via the Atmosphere
        </Text>
        <Text className="text-center text-xl text-foreground">
          No account? No problem.
        </Text>
        <View className="flex flex-col items-center justify-center">
          <Text className="-mx-3 mb-2 text-center">
            To use teal.fm, you’ll need a PDS—your personal data storage on the
            Atmosphere. Signing up with Bluesky is a great way to begin.
          </Text>
          <Text className="mb-4 text-center text-xs text-muted-foreground">
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
            className="flex flex-row items-center justify-center gap-2 bg-bsky"
          >
            <Text className="ml-2 text-sm text-secondary">To Bluesky</Text>
            <Icon icon={ArrowRight} />
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
