import React, { useState } from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router, Stack } from "expo-router";
import AuthPageTitle from "@/components/auth/AuthPageTitle";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { ArrowRight, AtSignIcon } from "lucide-react-native";

const LoginScreen = () => {
  const [opened, setOpened] = useState(false);
  return (
    <SafeAreaView className="flex flex-1 items-center justify-center bg-muted px-5">
      <AuthPageTitle path="/auth/signup" title="Create an account" />
      <Stack.Screen
        options={{
          title: "Create an account",
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
          Create your account
        </Text>
        <View className="flex flex-col items-center justify-center">
          <Text className="-mx-3 mb-2 text-center">
            Teal uses the same account as Bluesky and other Atmosphere apps.
            Create one with Bluesky, then use its handle to sign in here.
          </Text>
          <Text className="mb-4 text-center text-xs text-muted-foreground">
            Already have an account? You can sign in directly. Creating an
            account opens Bluesky in another tab.
          </Text>
          <Button
            onPress={() => {
              // on web, open new tab
              if (Platform.OS === "web") {
                window.open(
                  "https://bsky.app/signup",
                  "_blank",
                  "noopener,noreferrer",
                );
              } else {
                router.navigate("https://bsky.app");
              }
              setOpened(true);
            }}
            className="flex flex-row items-center justify-center gap-2"
          >
            <Text className="ml-2 text-sm">Continue to Bluesky</Text>
            <Icon icon={ArrowRight} />
          </Button>
          {opened && (
            <Text
              accessibilityLiveRegion="polite"
              className="mt-4 text-center text-muted-foreground"
            >
              Once your account is ready, return here and sign in with your new
              handle.
            </Text>
          )}
          <Link href="/auth/login" asChild>
            <Button variant="outline" className="mt-4">
              <Text>
                {opened
                  ? "Sign in with my new account"
                  : "I already have an account"}
              </Text>
            </Button>
          </Link>
          <Link href="/" asChild>
            <Button variant="link" className="mt-2">
              <Text>Back to Teal</Text>
            </Button>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
