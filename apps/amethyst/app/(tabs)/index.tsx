import * as React from "react";
import { View } from "react-native";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Text } from "../../components/ui/text";
import AuthOptions from "../auth/options";
import { useStore } from "../../stores/mainStore";

import { Response } from "@atproto/api/src/client/types/app/bsky/actor/getProfile";

const GITHUB_AVATAR_URI =
  "https://i.pinimg.com/originals/ef/a2/8d/efa28d18a04e7fa40ed49eeb0ab660db.jpg";

export default function Screen() {
  const [progress, setProgress] = React.useState(78);
  const [profile, setProfile] = React.useState<Response | null>(null);
  const j = useStore((state) => state.status);
  // @me
  const agent = useStore((state) => state.pdsAgent);
  const isReady = useStore((state) => state.isAgentReady);
  React.useEffect(() => {
    if (agent) {
      agent.getProfile({actor: "natalie.sh"}).then((profile) => {
        console.log(profile)
        return setProfile(profile);
      }).catch((e)=>{
        console.log(e)
      })
    } else {
      console.log("No agent")
    }
  }, [isReady]);

  if (j !== "loggedIn") {
    //router.replace("/auth/options");
    return <AuthOptions />;
  }

  function updateProgressValue() {
    setProgress(Math.floor(Math.random() * 100));
  }
  return (
    <View className="flex-1 justify-center items-center gap-5 p-6 bg-background">
      <Card className="w-full max-w-full p-6 rounded-2xl">
        <CardHeader className="items-center">
          <Avatar alt="Rick Sanchez's Avatar" className="w-24 h-24">
            <AvatarImage source={{ uri: profile?.data.avatar ?? GITHUB_AVATAR_URI }} />
            <AvatarFallback>
              <Text>{profile?.data.displayName?.substring(0,1) ?? " Richard"}</Text>
            </AvatarFallback>
          </Avatar>
          <View className="p-3" />
          <CardTitle className="text-center">{profile?.data.displayName ?? " Richard"}</CardTitle>
          <CardContent className="text-center w-full">
            {profile ? (profile.data?.description?.split('\n').map((str,i) => <Text className="text-center" key={i}>{str}</Text>) || "A very mysterious person") : "Loading..."}
          </CardContent>
        </CardHeader>
      </Card>
    </View>
  );
}
