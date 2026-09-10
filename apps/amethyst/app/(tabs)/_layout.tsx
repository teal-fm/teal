import React from "react";
import { Pressable, type ColorValue } from "react-native";
import { Link, Tabs } from "expo-router";
import useIsMobile from "@/hooks/useIsMobile";
import { useStore } from "@/stores/mainStore";
import {
  FilePen,
  Home,
  LogOut,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";

import Colors from "../../constants/Colors";
import { Icon, iconWithClassName } from "../../lib/icons/iconWithClassName";

function TabBarIcon(props: { name: LucideIcon; color: ColorValue }) {
  const Name = props.name;
  iconWithClassName(Name);
  return <Name size={28} className="text-muted" {...props} color={String(props.color)} />;
}

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const authStatus = useStore((state) => state.status);
  const isMobile = useIsMobile();
  const hideTabBar = !isMobile;

  return (
    <Tabs
      screenOptions={{
        title: "Home",
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in
        // React Navigation v6.
        headerShown: false, // useClientOnlyValue(false, true),
        headerStyle: {
          height: 50,
        },
        tabBarShowLabel: isMobile,

        tabBarStyle: {
          //height: 75,
          display: hideTabBar ? "none" : "flex",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabBarIcon name={Home} color={color} />,
          headerRight: () => (
            <Link href="/auth/logoutModal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <Icon
                    icon={LogOut}
                    className="mr-4 text-2xl text-muted-foreground"
                    name="log-out"
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="search/index"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => <TabBarIcon name={Search} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          href: null,
        }}
      />
      <Tabs.Screen
        name="(stamp)"
        options={{
          title: "Stamp",
          href: authStatus === "loggedIn" ? undefined : null,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name={FilePen} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: "Settings",
          href: authStatus === "loggedIn" ? undefined : null,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name={Settings} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/[handle]"
        options={{
          title: "Stamp",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name={FilePen} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
