import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";

import "react-native-reanimated";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme, verifyInstallation } from "nativewind";

import { GlobalTextClassContext } from "../components/ui/text";

import "../global.css";

import { SafeAreaView, View } from "react-native";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

let defaultFamily = (weight: string) => {
  return {
    fontFamily: "DM Sans",
    fontWeight: weight,
  } as Theme["fonts"]["regular"];
};
const THEME_FONTS: Theme["fonts"] = {
  heavy: defaultFamily("700"),
  bold: defaultFamily("600"),
  medium: defaultFamily("500"),
  regular: defaultFamily("400"),
};

const DARK_THEME: Theme = {
  ...DarkTheme,
  fonts: THEME_FONTS,
};

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  fonts: THEME_FONTS,
};

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
    CrimsonPro: require("../assets/fonts/CrimsonPro-VariableFont_wght.ttf"),
    "CrimsonPro Italic": require("../assets/fonts/CrimsonPro-Italic-VariableFont_wght.ttf"),
    "DM Sans": require("../assets/fonts/DMSans-VariableFont_opsz,wght.ttf"),
    Fraunces: require("../assets/fonts/Fraunces-VariableFont_SOFT,WONK,opsz,wght.ttf"),
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
    <SafeAreaView className="flex min-h-screen flex-1 flex-row justify-center bg-background">
      <View className="flex max-w-2xl flex-1 border-x border-muted-foreground/20 bg-background">
        <RootLayoutNav />
      </View>
    </SafeAreaView>
  );
}

function useTheme() {
  const { colorScheme, setColorScheme } = useColorScheme();

  // what??? how does this not break something
  setColorScheme(colorScheme || "system");

  console.log("Current scheme is", colorScheme);

  return colorScheme === "dark" ? DARK_THEME : LIGHT_THEME;
}

function RootLayoutNav() {
  verifyInstallation();

  return (
    <GestureHandlerRootView>
      <ThemeProvider value={useTheme()}>
        <GlobalTextClassContext.Provider value="font-sans">
          <BottomSheetModalProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
