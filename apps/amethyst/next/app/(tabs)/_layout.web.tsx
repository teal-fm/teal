import { View } from "react-native";
import { Tabs } from "expo-router";
import { useLayout, WindowBackdrop } from "@/next/components/ds";
import { WebNav } from "@/next/components/shell/WebNav";

export const unstable_settings = {
  initialRouteName: "(home)",
};

/** Browsers get a frosted sidebar on wide screens and a floating tab bar on phones. */
export default function WebTabLayout() {
  const { sidebar } = useLayout();
  return (
    <View className="flex-1">
      <WindowBackdrop />
      <Tabs
        tabBar={(props) => <WebNav {...props} wide={sidebar} />}
        screenOptions={{
          headerShown: false,
          tabBarPosition: sidebar ? "left" : "bottom",
          sceneStyle: { backgroundColor: "transparent" },
        }}
      >
        <Tabs.Screen name="(home)" options={{ title: "Today" }} />
        <Tabs.Screen name="(search)" options={{ title: "Explore" }} />
        <Tabs.Screen name="(updates)" options={{ title: "Activity" }} />
        <Tabs.Screen name="(you)" options={{ title: "You" }} />
      </Tabs>
    </View>
  );
}
