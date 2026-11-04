import { Platform } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { queryClient } from "@/lib/query";
import { restoreColorSchemePreference, useColorScheme } from "@/lib/useColorScheme";
// Importing the store restores a saved session on launch (see stores/mainStore).
import "@/stores/mainStore";

// global.entry.css imports global.css; metro.config.js explains why it exists.
import "../global.entry.css";

type Theme = typeof DefaultTheme;

const SYSTEM_FONT = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, Roboto, "Segoe UI", sans-serif',
  default: "System",
});
const fonts = Object.fromEntries(
  (["regular", "medium", "bold", "heavy"] as const).map((key, i) => [
    key,
    { fontFamily: SYSTEM_FONT, fontWeight: String(400 + i * 100) },
  ]),
) as Theme["fonts"];

// Scenes are transparent so the blurred-cover backdrop shows through every page.
const themes: Record<"light" | "dark", Theme> = {
  light: {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: "transparent", primary: "#0b7a73" },
    fonts,
  },
  dark: {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: "transparent", primary: "#3fc9bd" },
    fonts,
  },
};

void restoreColorSchemePreference();

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

const modal = {
  presentation: "transparentModal",
  animation: "fade",
  headerShown: false,
} as const;

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={themes[colorScheme === "dark" ? "dark" : "light"]}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/login" options={modal} />
            <Stack.Screen name="auth/logout" options={modal} />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
