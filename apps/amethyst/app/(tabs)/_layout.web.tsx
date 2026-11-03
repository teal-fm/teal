import { Tabs } from "expo-router";
import { useWindowDimensions, View } from "react-native";
import { WindowBackdrop } from "@/components/ds";
import { WebNav, WIDE_BREAKPOINT } from "@/components/shell/WebNav";

export const unstable_settings = {
  initialRouteName: "(home)",
};

/** Browsers get a frosted sidebar on wide screens and a floating tab bar on phones. */
export default function WebTabLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  return (
    <View className="flex-1">
      <WindowBackdrop />
    <Tabs
      tabBar={(props) => <WebNav {...props} wide={wide} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? "left" : "bottom",
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
