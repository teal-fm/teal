import * as React from "react";
import { View } from "react-native";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Text } from "../../components/ui/text";
import { useStore } from "../../stores/mainStore";
import AuthOptions from "../auth/options";

import { Response } from "@atproto/api/src/client/types/app/bsky/actor/getProfile";
import { Link, Stack } from "expo-router";
import { Button } from "@/components/ui/button";

const GITHUB_AVATAR_URI =
  "https://i.pinimg.com/originals/ef/a2/8d/efa28d18a04e7fa40ed49eeb0ab660db.jpg";

export default function Screen() {
  const [profile, setProfile] = React.useState<Response | null>(null);
  const j = useStore((state) => state.status);
  // @me
  const agent = useStore((state) => state.pdsAgent);
  const isReady = useStore((state) => state.isAgentReady);
  React.useEffect(() => {
    if (agent) {
      agent
        .getProfile({ actor: agent.did ?? "teal.fm" })
        .then((profile) => {
          console.log(profile);
          return setProfile(profile);
        })
        .catch((e) => {
          console.log(e);
        });
    } else {
      console.log("No agent");
    }
  }, [isReady, agent]);

  if (j !== "loggedIn") {
    return <AuthOptions />;
  }

  return (
    <View className="flex-1 justify-center items-center gap-5 p-6 bg-background">
      <Stack.Screen
        options={{
          title: "Home",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <Card className="py-6 rounded-2xl border-2 border-foreground">
        <CardHeader className="items-center pb-0">
          <Avatar alt="Rick Sanchez's Avatar" className="w-24 h-24">
            <AvatarImage
              source={{ uri: profile?.data.avatar ?? GITHUB_AVATAR_URI }}
            />
            <AvatarFallback>
              <Text>
                {profile?.data.displayName?.substring(0, 1) ?? " Richard"}
              </Text>
            </AvatarFallback>
          </Avatar>
          <View className="px-3" />
          <CardTitle className="text-center">
            {profile?.data.displayName ?? " Richard"}
          </CardTitle>
          <CardContent className="text-center w-full">
            {profile
              ? profile.data?.description?.split("\n").map((str, i) => (
                  <Text className="text-center" key={i}>
                    {str}
                  </Text>
                )) || "A very mysterious person"
              : "Loading..."}
          </CardContent>
        </CardHeader>
        <CardContent className="flex flex-row justify-center items-center p-0">
          <Link href="/stamp">
            <Button>
              <Text className="text-center">Ready to stamp!</Text>{" "}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </View>
  );
}
