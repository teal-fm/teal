import { Stack } from "expo-router";

// Each tab keeps its own stack. Shared pages (profiles, posts, music) push onto it.
export const unstable_settings = {
  "(home)": { initialRouteName: "index" },
  "(search)": { initialRouteName: "search/index" },
  "(updates)": { initialRouteName: "notifications" },
  "(you)": { initialRouteName: "me" },
};

export default function SharedStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
      }}
    />
  );
}
