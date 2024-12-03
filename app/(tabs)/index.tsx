import * as React from "react";
import { Linking, View } from "react-native";
import { Info } from "~/lib/icons/Info";
import { CalendarDays } from "~/lib/icons/CalendarDays";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Text } from "~/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import AuthOptions from "../auth/options";
import { useStore } from "@/stores/mainStore";

const GITHUB_AVATAR_URI =
  "https://i.pinimg.com/originals/ef/a2/8d/efa28d18a04e7fa40ed49eeb0ab660db.jpg";

export default function Screen() {
  const [progress, setProgress] = React.useState(78);
  const j = useStore((state) => state.jwt);
  if (!j) {
    //router.replace("/auth/options");
    return <AuthOptions />;
  }

  function updateProgressValue() {
    setProgress(Math.floor(Math.random() * 100));
  }
  return (
    <View className="flex-1 justify-center items-center gap-5 p-6 bg-background">
      <Card className="w-full max-w-sm p-6 rounded-2xl">
        <CardHeader className="items-center">
          <Avatar alt="Rick Sanchez's Avatar" className="w-24 h-24">
            <AvatarImage source={{ uri: GITHUB_AVATAR_URI }} />
            <AvatarFallback>
              <Text>RS</Text>
            </AvatarFallback>
          </Avatar>
          <View className="p-3" />
          <CardTitle className="text-center">{j.tokenSet?.sub}</CardTitle>
        </CardHeader>
      </Card>
    </View>
  );
}
