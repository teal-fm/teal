import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColorScheme } from "@/lib/useColorScheme";

export const unstable_settings = {
  initialRouteName: "(home)",
};

/**
 * Four places, one native tab bar: UITabBar (Liquid Glass) on iOS, Material
 * navigation on Android. Profiles, posts, and music pages push onto whichever
 * tab you are in; see the shared `(home,search,updates,you)` stack.
 */
export default function TabLayout() {
  const { isDarkColorScheme } = useColorScheme();
  return (
    <NativeTabs tintColor={isDarkColorScheme ? "#3fc9bd" : "#0b7a73"}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(search)">
        <NativeTabs.Trigger.Icon sf="safari" md="explore" />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(updates)">
        <NativeTabs.Trigger.Icon sf={{ default: "bell", selected: "bell.fill" }} md="notifications" />
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(you)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
          md="account_circle"
        />
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
