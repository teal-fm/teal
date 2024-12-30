import React from "react";
import { CodeXml, Home, Info, type LucideIcon } from "lucide-react-native";
import { Link, Stack, Tabs } from "expo-router";
import { Pressable } from "react-native";

import Colors from "../../constants/Colors";
import { useColorScheme } from "../../components/useColorScheme";
import { useClientOnlyValue } from "../../components/useClientOnlyValue";
import { iconWithClassName } from "../../lib/icons/iconWithClassName";

function TabBarIcon(props: { name: LucideIcon; color: string }) {
  const Name = props.name;
  iconWithClassName(Name);
  return <Name size={28} className="mt-4" {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        title: "Tab One",
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 75,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tab One",
          tabBarIcon: ({ color }) => <TabBarIcon name={Home} color={color} />,
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <Info
                    size={25}
                    color={Colors[colorScheme ?? "light"].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: "Tab Two",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name={CodeXml} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
