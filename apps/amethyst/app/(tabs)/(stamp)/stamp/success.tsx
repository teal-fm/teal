import { useContext, useEffect } from "react";
import { View } from "react-native";
import { Link, Redirect, Stack, useRouter } from "expo-router";
import { ExternalLink } from "@/components/ExternalLink";
import TealShell from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { listenHrefFromUri } from "@/lib/teal/routes";
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
    <TealShell pageTitle="Listen saved">
      <Stack.Screen
        options={{
          title: "Listen saved",
          headerShown: false,
        }}
      />
      <View className="min-h-[30rem] items-center justify-center gap-3 rounded-lg border border-border bg-card px-6">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
          <Check size={24} className="text-primary" />
        </View>
        <Text
          role="heading"
          aria-level={1}
          className="font-sans text-3xl font-black"
        >
          Listen saved
        </Text>
        <Text className="text-center text-muted-foreground">
          Your listen is saved. Public listening history may take a moment to
          update.
        </Text>
        {state.shareError && (
          <Text
            accessibilityRole="alert"
            className="text-center text-destructive"
          >
            {state.shareError}
          </Text>
        )}
        {listenHrefFromUri(state.submittedStamp.playAtUrl || undefined) && (
          <Link
            href={
              listenHrefFromUri(
                state.submittedStamp.playAtUrl || undefined,
              ) as any
            }
            asChild
          >
            <Button>
              <Text>View listen</Text>
            </Button>
          </Link>
        )}
        <Text className="text-sm text-muted-foreground">
          <ExternalLink
            className="text-primary"
            href={`https://pdsls.dev/${state.submittedStamp.playAtUrl}`}
          >
            View source record
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
            router.replace({
              pathname: "/stamp",
            });
          }}
        >
          <Text>Add another track</Text>
        </Button>
      </View>
    </TealShell>
  );
}
