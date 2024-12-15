import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons/iconWithClassName";
import { Check, ChevronRight, AtSign } from "lucide-react-native";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Link, Stack, router } from "expo-router";

import { useStore } from "@/stores/mainStore";
import createOAuthClient from "@/lib/atp/oauth";
import { resolveFromIdentity } from "@/lib/atp/pid";
import { openAuthSessionAsync } from "expo-web-browser";

const LoginScreen = () => {
  const [handle, setHandle] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { getLoginUrl, oauthCallback, status } = useStore((state) => state);

  const handleLogin = async () => {
    if (!handle) {
      Alert.alert("Error", "Please enter your handle");
      return;
    }

    setIsLoading(true);

    let redirUrl = await getLoginUrl(handle.replace("@", ""));
    if (!redirUrl) {
      // TODO: better error handling lulw
      Alert.alert("Error", "Failed to get login URL");
      return;
    }
    if (Platform.OS === "web") {
      // redirect to redir url page without authsession
      // shyould! redirect to /auth/callback
      router.navigate(redirUrl.toString());

    } else {
      const res = await openAuthSessionAsync(
        redirUrl.toString(),
        "http://127.0.0.1:8081/login"
      );
      if (res.type === "success") {
        const params = new URLSearchParams(res.url.split("?")[1]);
        await oauthCallback(params);
      }
    }

    // try {
    //   const response = await fetch(
    //     "https://natshare.z.teal.fm/oauth/login?spa="+ "web" + "&handle="+
    //       handle.replace("@", ""),
    //     {
    //       method: "GET",
    //     },
    //   );

    //   if (response.ok) {
    //     // Handle redirect URL (json url param)
    //     const j = await response.json();
    //     const redirectUrl = j.url;
    //     setIsRedirecting(true);
    //     if (!j.state) {
    //       console.log("No state in response, redirecting to error page");
    //       router.replace("/error");
    //       return;
    //     }
    //     setAuthCode(j.state);
    //     // Open the OAuth URL in the device's browser
    //     await Linking.openURL(redirectUrl);

    //     // Handle the callback URL when the user is redirected back
    //     console.log("Setting up deep link subscription");
    //     const subscription = Linking.addEventListener("url", async (event) => {
    //       console.log("Got a deep link event:", event);
    //       if (event.url.includes("/oauth/callback") && j.state) {
    //         console.log("Balls! state:", j.state);
    //         // redirect to callback page, add state to url
    //         router.navigate(
    //           `/auth/callback?state=${encodeURIComponent(j.state)}`,
    //         );
    //         subscription.remove();
    //       }
    //     });
    //   } else {
    //     const error = await response.json();
    //     Alert.alert("Error", error.error || "Failed to login");
    //   }
    // } catch (error: any) {
    //   console.error("Network error!", error);
    //   Alert.alert("Error", "Network error occurred:", error.message);
    // } finally {
    //   setIsLoading(false);
    // }
  };

  return (
    <SafeAreaView className="flex-1">
      <Stack.Screen
        options={{
          title: "Sign in",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="flex-1 justify-center align-center p-8 gap-4 pb-32 max-w-screen-sm">
        <View className="flex items-center">
          <Icon icon={AtSign} className="color-bsky" name="at" size={64} />
        </View>
        <Text className="text-3xl font-semibold text-center text-foreground">
          Sign in with your PDS
        </Text>
        <Text className="text-sm font-serif-old text-muted-foreground">
          Status: {status}
        </Text>
        <View>
          <Text className="text-sm text-muted-foreground">Handle</Text>
          <Input
            placeholder="alice.bsky.social"
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
          />
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
              isRedirecting ? "bg-green-500" : "bg-bsky"
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
