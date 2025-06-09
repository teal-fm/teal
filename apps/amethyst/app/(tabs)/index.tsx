import * as React from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Redirect, Stack, useRouter } from "expo-router";
import ActorView from "@/components/actor/actorView";
import { useStore } from "@/stores/mainStore";

import AuthOptions from "../auth/options";

export default function Screen() {
  const router = useRouter();
  const j = useStore((state) => state.status);
  // @me
  const agent = useStore((state) => state.pdsAgent);
  const profile = useStore((state) => state.profiles[agent?.did ?? ""]);
  const tealDid = useStore((state) => state.tealDid);
  const [hasTealProfile, setHasTealProfile] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        if (!agent || !tealDid) return;
        let res = await agent.call(
          "fm.teal.alpha.actor.getProfile",
          { actor: agent?.did },
          {},
          { headers: { "atproto-proxy": tealDid + "#teal_fm_appview" } },
        );
        if (isMounted) {
          setHasTealProfile(true);
        }
      } catch (error) {
        setHasTealProfile(false);
        console.error("Error fetching profile:", error);
        if (
          error instanceof Error &&
          error.message.includes("could not resolve proxy did")
        ) {
          router.replace("/offline");
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [agent, tealDid, router]);

  if (j !== "loggedIn") {
    return <AuthOptions />;
  }

  if (hasTealProfile !== null && !hasTealProfile) {
    return (
      <View className="flex-1 items-center justify-center gap-5 bg-background p-6">
        <Redirect href="/onboarding" />
      </View>
    );
  }

  // TODO: replace with skeleton
  if (!profile || !agent) {
    return (
      <View className="flex-1 items-center justify-center gap-5 bg-background p-6">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="w-full flex-1 items-center justify-start gap-5 bg-background">
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
