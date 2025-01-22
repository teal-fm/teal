import { Link, Stack, router } from "expo-router";
import { AlertCircle, AtSign, Check, ChevronRight } from "lucide-react-native";
import React, { useState } from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { cn } from "@/lib/utils";

import { openAuthSessionAsync } from "expo-web-browser";
import { useStore } from "@/stores/mainStore";

const LoginScreen = () => {
  const [handle, setHandle] = useState("");
  const [err, setErr] = useState<string | undefined>();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { getLoginUrl, oauthCallback } = useStore((state) => state);

  const handleLogin = async () => {
    if (!handle) {
      setErr("Please enter a handle");
      return
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
    <SafeAreaView className="flex-1 flex items-center justify-center w-full">
      <Stack.Screen
        options={{
          title: "Sign in",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="justify-center align-center p-8 gap-4 pb-32 max-w-screen-sm w-screen">
        <View className="flex items-center">
          <Icon icon={AtSign} className="color-bsky" name="at" size={64} />
        </View>
        <Text className="text-3xl font-semibold text-center text-foreground">
          Sign in with your PDS
        </Text>
        <View>
          <Text className="text-sm text-muted-foreground">Handle</Text>
          <Input
            className={err && `border-red-500 border-2`}
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
            <Text className="text-red-500 justify-baseline mt-1 text-xs">
              <Icon
                icon={AlertCircle}
                className="mr-1 inline -mt-0.5 text-xs"
                size={20}
              />
              {err}
            </Text>
          ) : (
            <View className="h-6" />
          )}
        </View>
        <View className="flex flex-row justify-between items-center">
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
                <Text className="font-semibold text-lg">Redirecting</Text>
                <Icon icon={Check} />
              </>
            ) : (
              <>
                <Text className="font-semibold text-lg">Login</Text>
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
