import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router, Stack } from "expo-router";
import { openAuthSessionAsync } from "expo-web-browser";
import AuthPageTitle from "@/components/auth/AuthPageTitle";
import { useWebDialog } from "@/components/auth/useWebDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { resolveFromIdentity } from "@/lib/atp/pid";
import { normalizeAuthHandle } from "@/lib/authHandle";
import { Icon } from "@/lib/icons/iconWithClassName";
import { capFirstLetter, cn } from "@/lib/utils";
import { useStore } from "@/stores/mainStore";
import { FontAwesome6 } from "@expo/vector-icons";
import {
  AlertCircle,
  AtSign,
  Check,
  ChevronRight,
  X,
} from "lucide-react-native";

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

  const [pdsUrl, setPdsUrl] = useState<Url | null>(null);
  const [isResolvingPds, setIsResolvingPds] = useState(false);
  const [pdsResolutionError, setPdsResolutionError] = useState<
    string | undefined
  >();

  const kb = useAnimatedKeyboard();

  const handleInputRef = useRef<TextInput>(null);
  const resolutionVersion = useRef(0);
  const closeLogin = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);
  const dialogRef = useWebDialog(closeLogin, "teal-login-title", "/auth/login");

  const { getLoginUrl, oauthCallback } = useStore((state) => state);

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
      const identityHandle = normalizeAuthHandle(currentHandle);
      const version = ++resolutionVersion.current;
      if (!identityHandle) {
        setPdsResolutionError(undefined);
        setIsResolvingPds(false);
        setPdsUrl(null);
        return;
      }
      setIsResolvingPds(true);
      setPdsResolutionError(undefined);
      setPdsUrl(null);
      try {
        const identity: ResolvedIdentity | null =
          await resolveFromIdentity(identityHandle);
        if (version !== resolutionVersion.current) return;
        if (!identity?.pds) throw new Error("Couldn't find this account.");
        setPdsUrl(identity.pds);
        callbacks?.onSuccess?.(identity.pds);
      } catch {
        if (version !== resolutionVersion.current) return;
        const message =
          "Couldn't find this account. Check your handle and try again.";
        setPdsResolutionError(message);
        callbacks?.onError?.(message);
      } finally {
        if (version === resolutionVersion.current) setIsResolvingPds(false);
      }
    },
    [],
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
      resolutionVersion.current += 1;
      setPdsUrl(null);
      setPdsResolutionError(undefined);
      setErr(undefined);
      setIsResolvingPds(false);

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      if (normalizeAuthHandle(text).length > 3) {
        debounceTimeoutRef.current = setTimeout(() => {
          getPdsUrl(normalizeAuthHandle(text), {
            onSuccess: (u) => {
              setPdsUrl(u);
            },
            onError: (e) => {
              setPdsResolutionError(e);
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
    if (isLoading || isRedirecting || !pdsUrl || isResolvingPds) return;
    // reset state
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    setIsResolvingPds(false);
    setPdsResolutionError(undefined);

    if (!normalizeAuthHandle(handle)) {
      setErr("Please enter a handle");
      return;
    }

    setIsLoading(true);
    setErr(undefined);

    try {
      let redirUrl = await getLoginUrl(normalizeAuthHandle(handle));
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
    <SafeAreaView className="flex w-full flex-1 bg-black/45 px-4">
      <AuthPageTitle path="/auth/login" title="Sign in" />
      <Stack.Screen
        options={{
          title: "Sign in",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <Pressable
        className="absolute inset-0"
        onPress={closeLogin}
        accessible={false}
        tabIndex={-1}
      />
      <View className="flex flex-1 items-center justify-center">
        <View className="w-full max-w-md">
          <Animated.View className="w-full" style={containerAnimatedStyle}>
            <View
              ref={dialogRef}
              className="align-center w-full justify-center gap-5 rounded-2xl border border-border bg-background p-7 shadow-2xl md:p-8"
            >
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
              <Text
                nativeID="teal-login-title"
                accessibilityRole="header"
                className="text-center font-sans text-3xl font-black text-foreground"
              >
                Sign in to Teal
              </Text>
              <Text className="text-center text-sm leading-5 text-muted-foreground">
                Use your Bluesky or other Atmosphere account. We'll send you to
                your account provider to approve sign-in.
              </Text>
              <View className="gap-2">
                <Text
                  nativeID="teal-login-handle-label"
                  className="text-sm font-bold text-foreground"
                >
                  Handle
                </Text>
                <Input
                  ref={handleInputRef}
                  accessibilityLabel="Handle"
                  aria-labelledby="teal-login-handle-label"
                  aria-invalid={Boolean(err || pdsResolutionError)}
                  className={cn(
                    "h-12 rounded-lg",
                    (err || pdsResolutionError) && `border-red-500`,
                  )}
                  placeholder="alice.bsky.social or did:plc:..."
                  value={handle}
                  onChangeText={handleTextChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onKeyPress={(e) => {
                    if (e.nativeEvent.key === "Enter") {
                      handleLogin();
                    }
                  }}
                />

                {(isResolvingPds || pdsResolutionError || pdsUrl) && (
                  <View
                    accessibilityLiveRegion="polite"
                    className="rounded-lg bg-muted p-3"
                  >
                    <View>
                      {pdsUrl !== null ? (
                        <View className="flex flex-row items-center gap-1">
                          <Text>Account provider:</Text>
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
                          <Text className="min-w-0 flex-1">
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
                          <Text accessibilityRole="alert" className="flex-1">
                            {pdsResolutionError}
                          </Text>
                        </View>
                      ) : (
                        <Text className="px-1 text-muted-foreground">
                          Finding your account...
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
              {err && (
                <Text accessibilityRole="alert" className="text-destructive">
                  {err}
                </Text>
              )}
              <View className="mt-2 flex flex-row flex-wrap items-center justify-between gap-3">
                <Link href="/auth/signup" asChild>
                  <Button variant="link" className="p-0">
                    <Text className="text-sm text-primary">
                      Create an account
                    </Text>
                  </Button>
                </Link>
                <Button
                  className="flex flex-row justify-end gap-1"
                  onPress={handleLogin}
                  disabled={
                    !pdsUrl || isLoading || isRedirecting || isResolvingPds
                  }
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
