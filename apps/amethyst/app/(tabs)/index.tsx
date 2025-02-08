import * as React from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CardHeader, CardTitle } from "../../components/ui/card";
import { Text } from "@/components/ui/text";
import { useStore } from "@/stores/mainStore";
import AuthOptions from "../auth/options";

import { Stack } from "expo-router";
import ActorPlaysView from "@/components/play/actorPlaysView";

const GITHUB_AVATAR_URI =
  "https://i.pinimg.com/originals/ef/a2/8d/efa28d18a04e7fa40ed49eeb0ab660db.jpg";

export default function Screen() {
  const j = useStore((state) => state.status);
  // @me
  const agent = useStore((state) => state.pdsAgent);
  const profile = useStore((state) => state.profiles[agent?.did ?? ""]);

  if (j !== "loggedIn") {
    return <AuthOptions />;
  }

  // TODO: replace with skeleton
  if (!profile) {
    return (
      <View className="flex-1 justify-center items-center gap-5 p-6 bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 justify-start items-start gap-5 p-6 bg-background">
      <Stack.Screen
        options={{
          title: "Home",
          headerBackButtonDisplayMode: "minimal",
          headerShown: true,
        }}
      />
      <CardHeader className="items-start pb-0">
        <Avatar alt="Rick Sanchez's Avatar" className="w-24 h-24">
          <AvatarImage
            source={{ uri: profile.bsky?.avatar ?? GITHUB_AVATAR_URI }}
          />
          <AvatarFallback>
            <Text>
              {profile.bsky?.displayName?.substring(0, 1) ?? " Richard"}
            </Text>
          </AvatarFallback>
        </Avatar>
        <View className="px-3" />
        <CardTitle className="text-center">
          {profile.bsky?.displayName ?? " Richard"}
        </CardTitle>
        {profile
          ? profile.bsky?.description?.split("\n").map((str, i) => (
              <Text className="text-start self-start place-self-start" key={i}>
                {str}
              </Text>
            )) || "A very mysterious person"
          : "Loading..."}
      </CardHeader>
      <View className="max-w-xl w-full gap-2 pl-6 pt-6">
        <Text className="text-left text-3xl font-serif">Your Stamps</Text>
        <ActorPlaysView repo={agent?.did} />
      </View>
    </ScrollView>
  );
}
