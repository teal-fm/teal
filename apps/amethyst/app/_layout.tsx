import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import { verifyInstallation, useColorScheme } from "nativewind";

import { GlobalTextClassContext } from "../components/ui/text";
import "../global.css";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaView, View } from "react-native";

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
    <SafeAreaView className="flex-1 flex flex-row min-h-screen justify-center bg-background">
      <View className="max-w-screen-lg flex flex-1 border-x border-muted-foreground/20">
        {<RootLayoutNav />}
      </View>
    </SafeAreaView>
  );
}

function RootLayoutNav() {
  verifyInstallation();
  const { colorScheme, setColorScheme } = useColorScheme();

  // what??? how does this not break something
  setColorScheme(colorScheme ?? "system");

  return (
    <GestureHandlerRootView>
      <ThemeProvider value={colorScheme === "dark" ? DARK_THEME : LIGHT_THEME}>
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
