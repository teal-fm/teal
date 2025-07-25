import * as React from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Redirect, Stack, useRouter } from "expo-router";
import ActorView from "@/components/actor/actorView";
import { useStore } from "@/stores/mainStore";

import { Record as ProfileStatusRecord } from "@teal/lexicons/src/types/fm/teal/alpha/actor/profileStatus";

import AuthOptions from "../auth/options";

export default function Screen() {
  const router = useRouter();
  const j = useStore((state) => state.status);
  // @me
  const agent = useStore((state) => state.pdsAgent);
  const profile = useStore((state) => state.profiles[agent?.did ?? ""]);
  const tealDid = useStore((state) => state.tealDid);
  const [profileStatus, setProfileStatus] = useState<ProfileStatusRecord | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchProfileStatus = async () => {
      try {
        if (!agent) return;

        const res = await agent.call("com.atproto.repo.getRecord", {
          repo: agent.did,
          collection: "fm.teal.alpha.actor.profileStatus",
          rkey: "self",
        });

        if (isMounted) {
          setProfileStatus(res.data.value as ProfileStatusRecord);
        }
      } catch (error) {
        if (isMounted) {
          // If no record exists, user hasn't completed onboarding
          setProfileStatus(null);
        }
        console.error("Error fetching profile status:", error);
        if (
          error instanceof Error &&
          error.message.includes("could not resolve proxy did")
        ) {
          router.replace("/offline");
        }
      } finally {
        if (isMounted) {
          setStatusLoading(false);
        }
      }
    };

    fetchProfileStatus();

    return () => {
      isMounted = false;
    };
  }, [agent, router]);

  if (j !== "loggedIn") {
    return <AuthOptions />;
  }

  if (!statusLoading && (!profileStatus || profileStatus.completedOnboarding === "none")) {
    return (
      <View className="flex-1 items-center justify-center gap-5 bg-background p-6">
        <Redirect href="/onboarding" />
      </View>
    );
  }

  // TODO: replace with skeleton
  if (!profile || !agent || statusLoading) {
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
