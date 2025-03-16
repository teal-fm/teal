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
import ActorView from "@/components/actor/actorView";

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
  if (!profile || !agent) {
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
      <ActorView actorDid={agent.did!} pdsAgent={agent} />
    </ScrollView>
  );
}
