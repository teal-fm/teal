import React from "react";
import { FilePen, Home, LogOut, type LucideIcon } from "lucide-react-native";
import { Link, Tabs } from "expo-router";
import { Pressable } from "react-native";

import Colors from "../../constants/Colors";
import { useColorScheme } from "../../components/useColorScheme";
import { Icon, iconWithClassName } from "../../lib/icons/iconWithClassName";
import useIsMobile from "@/hooks/useIsMobile";
import { useStore } from "@/stores/mainStore";

function TabBarIcon(props: { name: LucideIcon; color: string }) {
  const Name = props.name;
  iconWithClassName(Name);
  return <Name size={28} className="" {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const authStatus = useStore((state) => state.status);
  // if we are on web but not native and web width is greater than 1024px
  const hideTabBar = useIsMobile() || authStatus !== "loggedIn";

  return (
    <Tabs
      screenOptions={{
        title: "Tab One",
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: false, // useClientOnlyValue(false, true),
        tabBarShowLabel: true,
        tabBarStyle: {
          //height: 75,
          display: hideTabBar ? "none" : "flex",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tab One",
          tabBarIcon: ({ color }) => <TabBarIcon name={Home} color={color} />,
          headerRight: () => (
            <Link href="/auth/logoutModal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <Icon
                    icon={LogOut}
                    className="text-2xl mr-4"
                    name="log-out"
                  />
                )}
              </Pressable>
            </Link>
          ),
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
    </Tabs>
  );
}
