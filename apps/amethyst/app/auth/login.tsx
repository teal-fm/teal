import React, { useState } from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router, Stack } from "expo-router";
import { openAuthSessionAsync } from "expo-web-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { cn } from "@/lib/utils";
import { useStore } from "@/stores/mainStore";
import { AlertCircle, AtSign, Check, ChevronRight } from "lucide-react-native";

const LoginScreen = () => {
  const [handle, setHandle] = useState("");
  const [err, setErr] = useState<string | undefined>();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { getLoginUrl, oauthCallback } = useStore((state) => state);

  const handleLogin = async () => {
    if (!handle) {
      setErr("Please enter a handle");
      return;
    }

    setIsLoading(true);

    try {
      let redirUrl = await getLoginUrl(handle.replace("@", ""));
      if (!redirUrl) {
        // TODO: better error handling lulw
        throw new Error("Could not get login url. ");
      }
      setIsRedirecting(true);
      if (Platform.OS === "web") {
        // redirect to redir url page without authsession
        // shyould! redirect to /auth/callback
        router.navigate(redirUrl.toString());
      } else {
        const res = await openAuthSessionAsync(
          redirUrl.toString(),
          "http://127.0.0.1:8081/login",
        );
        if (res.type === "success") {
          const params = new URLSearchParams(res.url.split("?")[1]);
          await oauthCallback(params);
        }
      }
    } catch (e: any) {
      console.error(e);
      setErr(e.message);
      setIsLoading(false);
      setIsRedirecting(false);
      return;
    }
  };

  return (
    <SafeAreaView className="flex w-full flex-1 items-center justify-center">
      <Stack.Screen
        options={{
          title: "Sign in",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="align-center w-screen max-w-screen-sm justify-center gap-4 p-8 pb-32">
        <View className="flex items-center">
          <Icon icon={AtSign} className="color-bsky" name="at" size={64} />
        </View>
        <Text className="text-center text-3xl text-foreground">
          Sign in with your PDS
        </Text>
        <View>
          <Text className="text-sm text-muted-foreground">Handle</Text>
          <Input
            className={err && `border-2 border-red-500`}
            placeholder="alice.bsky.social"
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === "Enter") {
                handleLogin();
              }
            }}
          />
          {err ? (
            <Text className="justify-baseline mt-1 text-xs text-red-500">
              <Icon
                icon={AlertCircle}
                className="-mt-0.5 mr-1 inline text-xs"
                size={20}
              />
              {err}
            </Text>
          ) : (
            <View className="h-6" />
          )}
        </View>
        <View className="flex flex-row items-center justify-between">
          <Link href="https://bsky.app/signup">
            <Text className="text-md ml-2 text-secondary">
              Sign up for Bluesky
            </Text>
          </Link>
          <Button
            className={cn(
              "flex flex-row justify-end duration-500",
              isRedirecting ? "bg-green-500" : "bg-bsky",
            )}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isRedirecting ? (
              <>
                <Text className="text-lg">Redirecting</Text>
                <Icon icon={Check} />
              </>
            ) : (
              <>
                <Text className="text-lg">Sign in</Text>
                <Icon icon={ChevronRight} />
              </>
            )}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
