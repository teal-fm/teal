import { useContext, useEffect } from "react";
import { View } from "react-native";
import { Redirect, Stack, useRouter } from "expo-router";
import { ExternalLink } from "@/components/ExternalLink";
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
    <View className="h-screen-safe flex-1 items-center bg-background p-4">
      <Stack.Screen
        options={{
          title: "Play Successfully Submitted",
        }}
      />
      <View className="flex min-h-full w-screen max-w-screen-md items-center justify-center gap-2 px-4">
        <Check size={48} className="text-green-600 dark:text-green-400" />
        <Text className="text-xl">Play Submitted!</Text>
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
    </View>
  );
}
