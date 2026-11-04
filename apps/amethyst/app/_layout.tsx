import { useEffect } from "react";
import { Platform } from "react-native";
import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import Head from "expo-router/head";
import * as SplashScreen from "expo-splash-screen";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";

type Theme = typeof DefaultTheme;
import { PortalHost } from "@rn-primitives/portal";

import "react-native-reanimated";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";

import { GlobalTextClassContext } from "../components/ui/text";
import { queryClient } from "../lib/query";
import {
  restoreColorSchemePreference,
  useColorScheme,
} from "../lib/useColorScheme";

// global.entry.css imports global.css; see metro.config.js for why it exists.
import "../global.entry.css";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

// The redesign sets UI type in the platform system face.
const SYSTEM_FONT = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, Roboto, "Segoe UI", sans-serif',
  default: "System",
});
let defaultFamily = (weight: string) => {
  return {
    fontFamily: SYSTEM_FONT,
    fontWeight: weight,
  } as Theme["fonts"]["regular"];
};
const THEME_FONTS: Theme["fonts"] = {
  heavy: defaultFamily("700"),
  bold: defaultFamily("600"),
  medium: defaultFamily("500"),
  regular: defaultFamily("400"),
};

// Scenes are transparent so the blurred-cover backdrop shows through; the page
// ground is painted by the backdrop itself (and html/body on the web).
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "transparent", primary: "#3fc9bd" },
  fonts: THEME_FONTS,
};

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "transparent", primary: "#0b7a73" },
  fonts: THEME_FONTS,
};

void restoreColorSchemePreference();

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    "DM Sans": require("../assets/fonts/DMSans-VariableFont_opsz,wght.ttf"),
    Fraunces: require("../assets/fonts/Fraunces-VariableFont_SOFT,WONK,opsz,wght.ttf"),
    "Crimson Pro": require("../assets/fonts/CrimsonPro-VariableFont_wght.ttf"),
    "Crimson Pro Italic": require("../assets/fonts/CrimsonPro-Italic-VariableFont_wght.ttf"),
    PlexMono: require("../assets/fonts/IBMPlexMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

function useTheme() {
  const { colorScheme } = useColorScheme();

  return colorScheme === "dark" ? DARK_THEME : LIGHT_THEME;
}

function RootLayoutNav() {
  const pathname = usePathname();
  const section = pathname.split("/")[1];
  const pageTitle =
    pathname === "/"
      ? "Today"
      : pathname.includes("/stats/")
        ? `Top ${pathname.split("/").pop()}`
        : pathname.endsWith("/topster")
          ? "Album chart"
          : (
              {
                search: "Explore",
                settings: "Settings",
                notifications: "Activity",
                me: "You",
                compose: "Post a song",
                profile: "Profile",
                post: "Post",
                listen: "Listen",
                playlist: "Playlist",
                "manual-listens": "Add listens",
                stamp: "Add a listen",
                onboarding: "Create your profile",
                auth: "Your account",
                offline: "Connection unavailable",
                error: "Something went wrong",
                ":o": "Music",
                "at:": "Open Teal link",
              } as Record<string, string>
            )[section] || "Page not found";

  return (
    <GestureHandlerRootView>
      <Head>
        <title>{pageTitle} · Teal</title>
      </Head>
      <ThemeProvider value={useTheme()}>
        <GlobalTextClassContext.Provider value="font-sans text-ink">
          <BottomSheetModalProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="auth/login"
                options={{
                  presentation: "transparentModal",
                  animation: "fade",
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="auth/logoutModal"
                options={{
                  presentation: "transparentModal",
                  animation: "fade",
                  headerShown: false,
                }}
              />
            </Stack>
            <PortalHost />
          </BottomSheetModalProvider>
        </GlobalTextClassContext.Provider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
