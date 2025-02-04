import { ExternalLink } from "@/components/ExternalLink";
import { Redirect, Stack, useRouter } from "expo-router";
import { Check, ExternalLinkIcon } from "lucide-react-native";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { StampContext, StampContextValue, StampStep } from "./_layout";
import { useContext, useEffect } from "react";
import { Button } from "@/components/ui/button";

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
    <View className="flex-1 p-4 bg-background items-center h-screen-safe">
      <Stack.Screen
        options={{
          title: "Play Successfully Submitted",
        }}
      />
      <View className="flex justify-center items-center gap-2 max-w-screen-md w-screen min-h-full px-4">
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
          <ExternalLinkIcon className="inline mb-0.5 ml-0.5" size="1rem" />
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
