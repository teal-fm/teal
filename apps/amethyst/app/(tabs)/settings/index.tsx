import React from "react";
import { ScrollView, Switch, View } from "react-native";
import { Link, Stack } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const colorSchemeOptions = [
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "System", value: "system" },
  ];

  return (
    <ScrollView className="w-full flex-1 items-center justify-start gap-5 bg-background">
      <Stack.Screen
        options={{
          title: "Settings",
          headerBackButtonDisplayMode: "minimal",
          headerShown: true,
        }}
      />
      <View className="mx-5 my-2 flex w-screen max-w-2xl flex-1 flex-col gap-4 divide-y divide-muted-foreground/50 rounded-xl p-4">
        <ButtonSelector
          text="Theme"
          values={colorSchemeOptions}
          selectedValue={colorScheme}
          setSelectedValue={setColorScheme}
        />
        <Link href="/auth/logoutModal" asChild>
          <Button variant="destructive" size="sm" className="mt-4 w-max pb-1">
            <Text>Sign out</Text>
          </Button>
        </Link>
      </View>
    </ScrollView>
  );
}

function ToggleSwitch({
  text,
  isEnabled,
  setIsEnabled,
}: {
  text: string;
  isEnabled: boolean;
  setIsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const toggleSwitch = () =>
    setIsEnabled((previousState: boolean) => !previousState);

  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-lg">{text}</Text>
      <Switch className="ml-4" value={isEnabled} onValueChange={toggleSwitch} />
    </View>
  );
}

/// A selector component for smaller selections (usu. <3 values)
function ButtonSelector({
  text,
  values,
  selectedValue,
  setSelectedValue,
}: {
  text: string;
  values: { label: string; value: string }[];
  selectedValue: string;
  setSelectedValue: (value: any) => void;
}) {
  return (
    <View className="items-start gap-2 pt-2">
      <Text className="text-lg">{text}</Text>
      <View className="h-10 w-full flex-row items-center justify-around gap-1 rounded-xl bg-muted px-1">
        {values.map(({ label, value }) => (
          <Button
            key={value}
            onPress={() => setSelectedValue(value)}
            className={`h-8 w-full flex-1`}
            variant={selectedValue === value ? "secondary" : "ghost"}
          >
            <Text
              className={cn(
                selectedValue === value
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </Text>
          </Button>
        ))}
      </View>
    </View>
  );
}
