import React, { useCallback, useEffect, useRef, useState } from "react"; // Added useCallback, useRef
import { Platform, Pressable, TextInput, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router, Stack } from "expo-router";
import { openAuthSessionAsync } from "expo-web-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { resolveFromIdentity } from "@/lib/atp/pid";
import { Icon } from "@/lib/icons/iconWithClassName";
import { capFirstLetter, cn } from "@/lib/utils";
import { useStore } from "@/stores/mainStore";
import { FontAwesome6 } from "@expo/vector-icons";
import { AlertCircle, AtSign, Check, ChevronRight, X } from "lucide-react-native";

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

  const kb = useAnimatedKeyboard();

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

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const isKeyboardOpen = kb.height.value > 0;
    return {
      bottom: withTiming(isKeyboardOpen ? kb.height.value / 3 : 0, {
        duration: 250,
      }),
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
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const closeLogin = () => {
    if (Platform.OS === "web") {
      window.history.back();
      return;
    }
    router.dismiss();
  };

  return (
    <SafeAreaView className="flex w-full flex-1 bg-black/45 px-4">
      <Stack.Screen
        options={{
          title: "Sign in",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <Pressable className="absolute inset-0" onPress={closeLogin} />
      <View className="flex flex-1 items-center justify-center">
        <View className="w-full max-w-md">
          <Animated.View
            className="w-full"
            style={containerAnimatedStyle}
          >
            <View className="align-center w-full justify-center gap-5 rounded-2xl border border-border bg-background p-7 shadow-2xl md:p-8">
              <Button
                variant="ghost"
                size="icon"
                accessibilityLabel="Close sign in"
                className="absolute right-4 top-4 z-10 h-9 w-9 items-center justify-center rounded-full bg-muted"
                onPress={closeLogin}
              >
                <Icon
                  icon={X}
                  className="pointer-events-none text-muted-foreground"
                  size={18}
                />
              </Button>
              <View className="flex items-center">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
                  <Icon
                    icon={AtSign}
                    className="text-primary-foreground"
                    name="at"
                    size={24}
                  />
                </View>
              </View>
              <Text className="text-center font-sans text-3xl font-black text-foreground">
                Sign in to Teal
              </Text>
              <Text className="text-center text-sm leading-5 text-muted-foreground">
                Use the handle for your ATProto account. Teal will resolve your PDS
                before continuing.
              </Text>
              <View className="gap-2">
                <Text className="text-sm font-bold text-foreground">Handle</Text>
                <Input
                  ref={handleInputRef}
                  className={cn(
                    "h-12 rounded-lg",
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
                      "-mt-7 rounded-lg border border-border p-2 transition-all duration-300",
                      isSelected ? "pt-9" : "pt-8",
                      pdsUrl !== null
                        ? pdsUrl.hostname.includes("bsky.network")
                          ? "bg-sky-400 dark:bg-sky-800"
                          : "bg-teal-400 dark:bg-teal-800"
                        : pdsResolutionError && "bg-red-300 dark:bg-red-800",
                    )}
                  >
                    {pdsUrl !== null ? (
                      <View className="flex flex-row items-center gap-1">
                        <Text>PDS:</Text>
                        {pdsUrl.hostname.includes("bsky.network") && (
                          <View className="flex flex-row justify-center gap-0.5 pr-0.5">
                            <Icon
                              icon={FontAwesome6}
                              className="color-bsky"
                              name="bluesky"
                              size={16}
                            />
                          </View>
                        )}
                        <Text>
                          {pdsUrl.hostname.includes("bsky.network")
                            ? "Bluesky (" +
                              capFirstLetter(
                                pdsUrl.hostname.split(".").shift() || "",
                              ) +
                              ")"
                            : pdsUrl.hostname}
                        </Text>
                      </View>
                    ) : pdsResolutionError ? (
                      <View className="flex flex-row">
                        <Icon
                          icon={AlertCircle}
                          className="mr-1 inline text-foreground"
                          size={18}
                        />
                        <Text className="justify-baseline flex">
                          {pdsResolutionError}
                        </Text>
                      </View>
                    ) : (
                      <Text className="px-1 text-muted-foreground">
                        Resolving PDS...
                      </Text>
                    )}
                  </View>
                </Animated.View>
              </View>
              <View className="mt-2 flex flex-row items-center justify-between gap-3">
                <Link href="https://bsky.app/signup" asChild>
                  <Button variant="link" className="p-0">
                    <Text className="text-md text-secondary">
                      Sign up for Bluesky
                    </Text>
                  </Button>
                </Link>
                <Button
                  className={cn(
                    "flex flex-row justify-end gap-1",
                    isRedirecting ? "bg-primary" : "bg-primary",
                  )}
                  onPress={handleLogin}
                  disabled={!pdsUrl}
                >
                  {isRedirecting ? (
                    <>
                      <Text>Redirecting</Text>
                      <Icon icon={Check} />
                    </>
                  ) : isLoading ? (
                    <Text>Signing in...</Text>
                  ) : (
                    <>
                      <Text>Sign in</Text>
                      <Icon icon={ChevronRight} />
                    </>
                  )}
                </Button>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
