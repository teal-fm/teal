import React from "react";
import { View } from "react-native";
import { Link, Stack } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function AuthOptions() {
  return (
    <View className="flex-1 items-center justify-center gap-5 bg-background p-6">
      <Stack.Screen
        options={{
          title: "Sign in",

          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="gap-2">
        <Text className="text-center text-5xl text-foreground">
          Get started with
        </Text>
        <Text className="text-center text-5xl text-foreground font-bold">
          teal
          <Text className="font-serif-old-italic text-5xl text-primary">.fm</Text>
        </Text>
      </View>
      <View className="flex items-center gap-6">
        <Link href="/auth/login" className="text-secondary">
          <Button size="lg">
            <Text>Sign in with ATProto</Text>
          </Button>
        </Link>
        <Link href="/auth/signup" className="text-secondary">
          <Button size="lg">
            <Text>Sign up</Text>
          </Button>
        </Link>
      </View>
    </View>
  );
}
