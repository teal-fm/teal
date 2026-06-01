import { useContext, useEffect } from "react";
import { View } from "react-native";
import { Redirect, Stack, useRouter } from "expo-router";
import { ExternalLink } from "@/components/ExternalLink";
import RightRail from "@/components/songish/RightRail";
import SongishShell from "@/components/songish/SongishShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Check, ExternalLinkIcon } from "lucide-react-native";

import { StampContext, StampContextValue, StampStep } from "./_layout";

export default function StepThree() {
  const router = useRouter();
  const ctx = useContext(StampContext);
  const { state, setState } = ctx as StampContextValue;
  // reset on unmount
  useEffect(() => {
    return () => {
      setState({ step: StampStep.IDLE, resetSearchState: true });
    };
  }, [setState]);
  if (state.step !== StampStep.SUBMITTED) {
    console.log("Stamp state is not submitted!");
    console.log(state.step);
    return <Redirect href="/stamp" />;
  }
  return (
    <SongishShell rightRail={<RightRail />}>
      <Stack.Screen
        options={{
          title: "Play submitted",
          headerShown: false,
        }}
      />
      <View className="min-h-[30rem] items-center justify-center gap-3 rounded-lg border border-border bg-card px-6">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
          <Check size={24} className="text-primary" />
        </View>
        <Text className="font-serif text-3xl font-black">Play submitted</Text>
        <Text>
          You can view your play{" "}
          <ExternalLink
            className="text-blue-600 dark:text-blue-400"
            href={`https://pdsls.dev/${state.submittedStamp.playAtUrl}`}
          >
            on PDSls
          </ExternalLink>
          <ExternalLinkIcon className="mb-0.5 ml-0.5 inline" size="1rem" />
        </Text>
        {state.submittedStamp.blueskyPostUrl && (
          <Text>
            Or you can{" "}
            <ExternalLink
              className="text-blue-600 dark:text-blue-400"
              href={state.submittedStamp.blueskyPostUrl}
            >
              view your Bluesky post.
            </ExternalLink>
          </Text>
        )}
        <Button
          className="mt-2"
          onPress={() => {
            setState({ step: StampStep.IDLE, resetSearchState: true });
            router.back();
            // in case above doesn't work
            router.replace({
              pathname: "/stamp",
            });
          }}
        >
          <Text>Submit another</Text>
        </Button>
      </View>
    </SongishShell>
  );
}
