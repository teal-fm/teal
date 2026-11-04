import { useEffect, useRef } from "react";
import { Platform, View, type ViewStyle } from "react-native";
import { Stack, useIsFocused } from "expo-router";

// Each tab keeps its own stack. Shared pages (profiles, posts, music) push onto it.
// expo-router keys these by bare group name, so a deep link lands on top of the tab's root.
export const unstable_settings = {
  home: { initialRouteName: "index" },
  search: { initialRouteName: "search/index" },
  updates: { initialRouteName: "notifications" },
  you: { initialRouteName: "me" },
};

// Browsers keep inactive tabs mounted, and scenes are transparent so the backdrop shows,
// so a tab that isn't focused is hidden (keeping its scroll position) and made inert.
const HIDDEN = { visibility: "hidden" } as ViewStyle;

export default function SharedStack() {
  const focused = useIsFocused();
  const ref = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || !ref.current) return;
    (ref.current as unknown as HTMLElement).inert = !focused;
  }, [focused]);

  return (
    <View ref={ref} style={[{ flex: 1 }, Platform.OS === "web" && !focused ? HIDDEN : null]}>
      {/* Compose opens as a sheet. It's set here rather than as a <Stack.Screen>, because
          explicitly listed screens sort ahead of the tab's root and would become its first route. */}
      <Stack
        screenOptions={({ route }) => ({
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
          presentation: route.name === "compose" ? "modal" : undefined,
        })}
      />
    </View>
  );
}
