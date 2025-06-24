import React from "react";
import { TabList, Tabs, TabSlot, TabTrigger } from "expo-router/ui";
import { useStore } from "@/stores/mainStore";
import {
  HomeIcon,
  PlayIcon,
  UserIcon,
  CogIcon,
} from "lucide-react-native";

import AuthOptions from "../auth/options";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { cn } from "@/lib/utils";

const tabClass = (className?: string) => cn(
  "size-16 flex flex-col justify-center items-center gap-y-2 hover:text-foreground duration-200 transition-color",
  className,
);

export default function TabLayout() {
  const j = useStore((state) => state.status);
  const agent = useStore((state) => state.pdsAgent);
  const profile = useStore((state) => state.profiles[agent?.did ?? ""]);

  if (j !== "loggedIn") {
    return <AuthOptions />;
  }

  return (
    <Tabs>
      <TabSlot />

      <TabList className="min-h-16 bg-background border-t border-border flex items-center justify-center text-muted-foreground">
        <TabTrigger className={tabClass()} name="home" href="/">
          <HomeIcon />
        </TabTrigger>

        <TabTrigger className={tabClass()} name="stamp" href="/stamp">
          <PlayIcon />
        </TabTrigger>

        <TabTrigger className={tabClass()} name="settings/index" href="/settings">
          <CogIcon />
        </TabTrigger>

        {(profile && profile.bsky && profile.teal) && (
          <TabTrigger className={tabClass()} name="profile/[handle]" href={`/profile/${profile.bsky ? profile.bsky.handle : ''}`}>
            <Avatar alt={profile.teal ? profile.teal.displayName! : 'User'}>
              <AvatarImage source={{ uri: profile.teal ? getImageCdnLink({ did: profile.teal.did!, hash: profile.teal.avatar! }) : undefined }} />
              <AvatarFallback>
                <UserIcon />
              </AvatarFallback>
            </Avatar>
          </TabTrigger>
        )}
      </TabList>
    </Tabs>
  );
}
