import React from "react";

import {
  FilePen,
  Home,
  LogOut,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react-native";
import { Link, Tabs } from "expo-router";
import { Pressable } from "react-native";

import Colors from "../../constants/Colors";
import { Icon, iconWithClassName } from "../../lib/icons/iconWithClassName";
//import useIsMobile from "@/hooks/useIsMobile";
import { useStore } from "@/stores/mainStore";
import { useColorScheme } from "nativewind";
import AuthOptions from "../auth/options";
import useIsMobile from "@/hooks/useIsMobile";

function TabBarIcon(props: { name: LucideIcon; color: string }) {
  const Name = props.name;
  iconWithClassName(Name);
  return <Name size={28} className="text-muted" {...props} />;
}

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const authStatus = useStore((state) => state.status);
  const isMobile = useIsMobile();
  // if we are on web but not native and web width is greater than 1024px
  const hideTabBar = authStatus !== "loggedIn"; // || useIsMobile()

  const j = useStore((state) => state.status);
  // @me
  const agent = useStore((state) => state.pdsAgent);
  const profile = useStore((state) => state.profiles[agent?.did ?? ""]);

  if (j !== "loggedIn") {
    return <AuthOptions />;
  }

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
                    className="text-2xl mr-4 text-muted-foreground"
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
          title: "Search",
          tabBarIcon: ({ color }) => <TabBarIcon name={Search} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(stamp)"
        options={{
          title: "Stamp",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name={FilePen} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: "Settings",

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
