import { useMemo } from "react";
import { Stack } from "expo-router";

const Layout = ({ segment }: { segment: string }) => {
  const rootScreen = useMemo(() => {
    switch (segment) {
      case "(home)":
        return (
          <Stack.Screen
            name="index"
            options={{ title: "Home", headerShown: false }}
          />
        );
      case "(explore)":
        return (
          <Stack.Screen
            name="explore"
            options={{ title: "Explore", headerShown: false }}
          />
        );
    }
  }, [segment]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: {
          height: 50,
        } as any,
      }}
    >
      {rootScreen}
    </Stack>
  );
};

export default Layout;
