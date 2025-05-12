import ActorView from "@/components/actor/actorView";
import { Text } from "@/components/ui/text";
import { resolveHandle } from "@/lib/atp/pid";
import { useStore } from "@/stores/mainStore";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

export default function Handle() {
  let { handle } = useLocalSearchParams();

  let agent = useStore((state) => state.pdsAgent);

  // resolve handle
  const [did, setDid] = useState<string | null>(null);
  useEffect(() => {
    const fetchAgent = async () => {
      const agent = await resolveHandle(
        typeof handle === "string" ? handle : handle[0] && handle[0],
      );
      setDid(agent);
    };
    if (handle !== "undefined") fetchAgent();
  }, [handle]);

  if (handle === "undefined") {
    return <Text>Handle is undefined</Text>;
  }

  if (!did) return <ActivityIndicator size="large" color="#0000ff" />;

  return (
    <ScrollView className="w-full flex-1 items-center justify-start gap-5 bg-background">
      <Stack.Screen
        options={{
          title: "Home",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <ActorView actorDid={did} pdsAgent={agent} />
    </ScrollView>
  );
}
