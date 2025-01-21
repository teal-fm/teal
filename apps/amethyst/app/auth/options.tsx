import { Link, Stack, router } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import React from "react";

export default function AuthOptions() {
  return (
    <View className="flex-1 justify-center items-center gap-5 p-6 bg-background">
      <Stack.Screen
        options={{
          title: "Sign in",

          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="gap-2">
        <Text className="text-5xl font-semibold text-center text-foreground">
          Get started with
        </Text>
        <Text className="text-center text-5xl font-semibold text-foreground">
          teal
          <Text className="text-5xl font-serif-old-italic">.fm</Text>
        </Text>
      </View>
      <Link href="/auth/login" className="text-secondary">
        <Button
          className="flex flex-row justify-center items-center rounded-full dark-blue-800 dark:bg-blue-400 gap-2"
          size="lg"
          onTouchStart={() => {
            router.push("/auth/login");
          }}
        >
          <Text>Sign in with ATProto</Text>
        </Button>
      </Link>
      <Link href="/signup" className="text-secondary">
        <Button
          className="flex flex-row justify-center items-center rounded-full"
          size="lg"
          onTouchStart={() => {
            router.push("/auth/signup");
          }}
        >
          <Text>Sign up</Text>
        </Button>
      </Link>
    </View>
  );
}
