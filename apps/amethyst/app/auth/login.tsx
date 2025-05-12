import { Link, Stack, router } from "expo-router";
import { AlertCircle, AtSign, Check, ChevronRight } from "lucide-react-native";
import React, { useState, useEffect, useCallback, useRef } from "react"; // Added useCallback, useRef
import { Platform, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { capFirstLetter, cn } from "@/lib/utils";

import { openAuthSessionAsync } from "expo-web-browser";
import { useStore } from "@/stores/mainStore";
import { resolveFromIdentity } from "@/lib/atp/pid";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";

type Url = URL;

interface ResolvedIdentity {
  pds: Url;
  [key: string]: any;
}

const DEBOUNCE_DELAY = 500; // 500ms debounce delay

const LoginScreen = () => {
  const [handle, setHandle] = useState("");
  const [err, setErr] = useState<string | undefined>();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelected, setIsSelected] = useState(false);

  const [pdsUrl, setPdsUrl] = useState<Url | null>(null);
  const [isResolvingPds, setIsResolvingPds] = useState(false);
  const [pdsResolutionError, setPdsResolutionError] = useState<
    string | undefined
  >();

  const handleInputRef = useRef<TextInput>(null);

  const { getLoginUrl, oauthCallback } = useStore((state) => state);

  const messageAnimation = useSharedValue(0);

  // focus on load
  useEffect(() => {
    if (handleInputRef.current) {
      handleInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (isResolvingPds || pdsResolutionError || pdsUrl) {
      messageAnimation.value = withTiming(1, { duration: 500 });
    } else {
      messageAnimation.value = withTiming(0, { duration: 400 });
    }
  }, [isResolvingPds, pdsResolutionError, messageAnimation, pdsUrl]);

  const messageContainerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: messageAnimation.value,
      maxHeight: interpolate(messageAnimation.value, [0, 1], [0, 100]),
      marginTop: -8,
      paddingTop: 8,
      overflow: "hidden",
      zIndex: -1,
    };
  });

  const getPdsUrl = useCallback(
    async (
      currentHandle: string,
      callbacks?: {
        onSuccess?: (resolvedPdsUrl: Url) => void;
        onError?: (errorMessage: string) => void;
      },
    ): Promise<void> => {
      // Ensure we're not calling with an empty or whitespace-only handle due to debounce race.
      if (!currentHandle || currentHandle.trim() === "") {
        // Clear any potential resolving/error states if triggered by empty text
        setPdsResolutionError(undefined);
        setIsResolvingPds(false);
        setPdsUrl(null);
        callbacks?.onError?.("Handle cannot be empty for PDS resolution."); // Optional: notify caller
        return;
      }

      setIsResolvingPds(true);
      setPdsResolutionError(undefined);
      setPdsUrl(null);
      try {
        console.log(`Attempting to resolve PDS for handle: ${currentHandle}`);
        const identity: ResolvedIdentity | null =
          await resolveFromIdentity(currentHandle);

        if (!identity || !identity.pds) {
          throw new Error("Could not resolve PDS from the provided handle.");
        }

        setPdsUrl(identity.pds);
        callbacks?.onSuccess?.(identity.pds);
        setIsResolvingPds(false);
      } catch (e: any) {
        const errorMessage =
          e.message || "An unknown error occurred while resolving PDS.";
        setPdsResolutionError(errorMessage);
        callbacks?.onError?.(errorMessage);
      } finally {
        if (pdsResolutionError && isResolvingPds) {
          setIsResolvingPds(false);
        }
      }
    },
    [isResolvingPds, pdsResolutionError],
  );
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      setHandle(text);

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      if (text.trim().length > 3) {
        debounceTimeoutRef.current = setTimeout(() => {
          getPdsUrl(text.trim(), {
            onSuccess: (u) => {
              setPdsUrl(u);
            },
            onError: (e) => {
              console.error(e);
              setPdsResolutionError("Couldn't resolve handle");
            },
          });
        }, DEBOUNCE_DELAY);
      } else {
        setPdsResolutionError(undefined);
        setIsResolvingPds(false);
        setPdsUrl(null);
      }
    },
    [getPdsUrl],
  );

  const handleLogin = async () => {
    // reset state
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    setIsResolvingPds(false);
    setPdsResolutionError(undefined);

    if (!handle) {
      setErr("Please enter a handle");
      return;
    }

    setIsLoading(true);
    setErr(undefined);

    try {
      let redirUrl = await getLoginUrl(handle.replace("@", ""));
      if (!redirUrl) {
        throw new Error("Could not get login url.");
      }
      setIsRedirecting(true);
      if (Platform.OS === "web") {
        router.navigate(redirUrl.toString());
      } else {
        const res = await openAuthSessionAsync(
          redirUrl.toString(),
          "http://127.0.0.1:8081/login",
        );
        if (res.type === "success") {
          const params = new URLSearchParams(res.url.split("?")[1]);
          await oauthCallback(params);
        } else if (res.type === "cancel" || res.type === "dismiss") {
          setErr("Login cancelled by user.");
          setIsRedirecting(false);
          setIsLoading(false);
          return;
        } else {
          throw new Error("Authentication failed or was cancelled.");
        }
      }
    } catch (e: any) {
      setErr(e.message || "An unknown error occurred during login.");
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
      <View className="justify-center align-center p-8 gap-4 pb-32 max-w-lg w-screen">
        <View className="flex items-center">
          <Icon icon={AtSign} className="color-bsky" name="at" size={64} />
        </View>
        <Text className="text-3xl text-center text-foreground">
          Sign in with your PDS
        </Text>
        <View>
          <Text className="text-sm text-muted-foreground">Handle</Text>
          <Input
            ref={handleInputRef}
            className={cn(
              "ring-0",
              (err || pdsResolutionError) && `border-red-500`,
            )}
            placeholder="alice.bsky.social or did:plc:..."
            value={handle}
            onChangeText={handleTextChange}
            onFocus={(e) => setIsSelected(true)}
            onBlur={(e) => setIsSelected(false)}
            autoCapitalize="none"
            autoCorrect={false}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === "Enter") {
                handleLogin();
              }
            }}
          />

          <Animated.View style={messageContainerAnimatedStyle}>
            <View
              className={cn(
                "p-2 -mt-7 rounded-xl border border-border transition-all duration-300",
                isSelected ? "pt-9" : "pt-8",
                pdsUrl !== null
                  ? pdsUrl.hostname.includes("bsky.network")
                    ? "bg-sky-400 dark:bg-sky-800"
                    : "bg-teal-400 dark:bg-teal-800"
                  : pdsResolutionError && "bg-red-300 dark:bg-red-800",
              )}
            >
              {pdsUrl !== null ? (
                <Text>
                  PDS:{" "}
                  {pdsUrl.hostname.includes("bsky.network") && (
                    <View className="gap-0.5 pr-0.5 flex-row">
                      <Icon
                        icon={FontAwesome6}
                        className="color-bsky"
                        name="bluesky"
                        size={16}
                      />
                      <Icon
                        icon={MaterialCommunityIcons}
                        className="color-red-400"
                        name="mushroom"
                        size={18}
                      />
                    </View>
                  )}
                  {pdsUrl.hostname.includes("bsky.network")
                    ? capFirstLetter(pdsUrl.hostname.split(".").shift() || "")
                    : pdsUrl.hostname}
                </Text>
              ) : pdsResolutionError ? (
                <Text className="justify-baseline px-1">
                  <Icon
                    icon={AlertCircle}
                    className="mr-1 inline -mt-0.5 text-xs"
                    size={24}
                  />
                  {pdsResolutionError}
                </Text>
              ) : (
                <Text className="text-muted-foreground px-1">
                  Resolving PDS...
                </Text>
              )}
            </View>
          </Animated.View>
        </View>
        <View className="flex flex-row justify-between items-center">
          <Link href="https://bsky.app/signup" asChild>
            <Button variant="link" className="p-0">
              <Text className="text-md text-secondary">
                Sign up for Bluesky
              </Text>
            </Button>
          </Link>
          <Button
            className={cn(
              "flex flex-row justify-end duration-500",
              isRedirecting ? "bg-green-500" : "bg-bsky",
            )}
            onPress={handleLogin}
            disabled={!pdsUrl}
          >
            {isRedirecting ? (
              <>
                <Text className="text-lg">Redirecting</Text>
                <Icon icon={Check} />
              </>
            ) : isLoading ? (
              <Text className="text-lg">Signing in...</Text>
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
