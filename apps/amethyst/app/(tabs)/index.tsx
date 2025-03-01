import * as React from "react";
import { ActivityIndicator, ScrollView, View, Image } from "react-native";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CardTitle } from "../../components/ui/card";
import { Text } from "@/components/ui/text";
import { useStore } from "@/stores/mainStore";
import AuthOptions from "../auth/options";

import { Stack } from "expo-router";
import ActorPlaysView from "@/components/play/actorPlaysView";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons/iconWithClassName";
import { Plus } from "lucide-react-native";

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
    <ScrollView className="flex-1 justify-start items-center gap-5 bg-background w-full">
      <Stack.Screen
        options={{
          title: "Home",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      {profile.bsky?.banner && (
        <Image
          className="w-full max-w-[100vh] h-32 md:h-44 scale-[1.32] rounded-xl -mb-6"
          source={{ uri: profile.bsky?.banner ?? GITHUB_AVATAR_URI }}
        />
      )}
      <View className="flex flex-col items-left justify-start text-left max-w-2xl w-screen gap-1 p-4 px-8">
        <View className="flex flex-row justify-between items-center">
          <View className="flex justify-between">
            <Avatar alt="Rick Sanchez's Avatar" className="w-24 h-24">
              <AvatarImage
                source={{ uri: profile.bsky?.avatar ?? GITHUB_AVATAR_URI }}
              />
              <AvatarFallback>
                <Text>{profile.bsky?.displayName?.substring(0, 1) ?? "R"}</Text>
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-left flex w-full justify-between mt-2">
              {profile.bsky?.displayName ?? " Richard"}
            </CardTitle>
          </View>
          <View className="mt-8">
            <Button
              variant="outline"
              size="sm"
              className="text-white rounded-xl flex flex-row gap-2 justify-center items-center"
            >
              <Icon icon={Plus} size={18} />
              <Text>Follow</Text>
            </Button>
          </View>
        </View>
        <View>
          {profile
            ? profile.bsky?.description?.split("\n").map((str, i) => (
                <Text
                  className="text-start self-start place-self-start"
                  key={i}
                >
                  {str}
                </Text>
              )) || "A very mysterious person"
            : "Loading..."}
        </View>
      </View>
      <View className="max-w-2xl w-full gap-4 py-4 pl-8">
        <Text className="text-left text-2xl border-b border-b-muted-foreground/30 -ml-2 pl-2 mr-6">
          Your Stamps
        </Text>
        <ActorPlaysView repo={agent?.did} />
      </View>
    </ScrollView>
  );
}
