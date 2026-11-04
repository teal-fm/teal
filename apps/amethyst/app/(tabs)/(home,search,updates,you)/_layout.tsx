import { Stack } from "expo-router";

// Each tab keeps its own stack. Shared pages (profiles, posts, music) push onto it.
// expo-router keys these by bare group name, so a deep link lands on top of the tab's root.
export const unstable_settings = {
  home: { initialRouteName: "index" },
  search: { initialRouteName: "search/index" },
  updates: { initialRouteName: "notifications" },
  you: { initialRouteName: "me" },
};

export default function SharedStack() {
  return (
    // Compose opens as a sheet. It's set here rather than as a <Stack.Screen>, because
    // explicitly listed screens sort ahead of the tab's root and would become its first route.
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        presentation: route.name === "compose" ? "modal" : undefined,
      })}
    />
  );
}
