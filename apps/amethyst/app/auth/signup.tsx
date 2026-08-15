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
    <SafeAreaView className="flex flex-1 items-center justify-center bg-muted px-5">
      <Stack.Screen
        options={{
          title: "Sign in",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="w-full max-w-md items-center justify-center gap-4 rounded-lg border border-border bg-card p-7">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
          <Icon
            icon={AtSignIcon}
            className="text-primary-foreground"
            size={24}
          />
        </View>
        <Text className="text-center font-sans text-3xl font-black text-foreground">
          Sign up via the Atmosphere
        </Text>
        <Text className="text-center text-lg font-bold text-foreground">
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
            className="flex flex-row items-center justify-center gap-2"
          >
            <Text className="ml-2 text-sm">Continue to Bluesky</Text>
            <Icon icon={ArrowRight} />
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
