import { useState } from "react";
import { Linking, Platform, View } from "react-native";
import { Link } from "expo-router";
import { ArrowUpRight, AtSign } from "lucide-react-native";
import { Button, ButtonRow, Glass, Heading, Icon, PageTitle, Text } from "@/next/components/ds";

const SIGNUP_URL = "https://bsky.app/signup";

/** Teal uses an Atmosphere account, so creating one happens at Bluesky. */
export default function SignUp() {
  const [opened, setOpened] = useState(false);
  const open = () => {
    if (Platform.OS === "web") window.open(SIGNUP_URL, "_blank", "noopener,noreferrer");
    else void Linking.openURL(SIGNUP_URL);
    setOpened(true);
  };
  return (
    <View className="flex-1 items-center justify-center bg-ground px-4">
      <PageTitle title="Create an account" />
      <Glass className="w-full max-w-md gap-3 p-7">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-tint">
          <Icon icon={AtSign} size={24} className="text-on-tint" />
        </View>
        <Heading level={1} size="title">
          Create your account
        </Heading>
        <Text className="text-[15px] text-ink-2">
          Teal uses the same account as Bluesky and other Atmosphere apps. Create one with Bluesky, then sign in here
          with its handle.
        </Text>
        <ButtonRow>
          <Button label="Continue to Bluesky" icon={ArrowUpRight} onPress={open} />
          <Link href="/auth/login" asChild>
            <Button label={opened ? "Sign in with my new account" : "I already have an account"} variant="secondary" />
          </Link>
        </ButtonRow>
        {opened ? (
          <Text aria-live="polite" className="text-[14px] text-ink-2">
            Once your account is ready, come back and sign in with your new handle.
          </Text>
        ) : null}
      </Glass>
    </View>
  );
}
