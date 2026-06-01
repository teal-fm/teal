import React from "react";
import { View } from "react-native";
import { Link, Stack } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function AuthOptions() {
  return (
    <View className="flex-1 items-center justify-center bg-muted p-6">
      <Stack.Screen
        options={{
          title: "Sign in",

          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="w-full max-w-md gap-5 rounded-lg border border-border bg-card p-7">
        <Text className="font-serif text-4xl font-black text-foreground">
          Welcome to Teal
        </Text>
        <Text className="leading-6 text-muted-foreground">
          A music listening network built on ATProto. Use an existing account or
          create one through Bluesky.
        </Text>
        <Link href="/auth/login" asChild>
          <Button className="flex-row gap-2" size="lg">
            <Text>Sign in with ATProto</Text>
          </Button>
        </Link>
        <Link href="/auth/signup" asChild>
          <Button variant="outline" size="lg">
            <Text>Create an account</Text>
          </Button>
        </Link>
      </View>
    </View>
  );
}
