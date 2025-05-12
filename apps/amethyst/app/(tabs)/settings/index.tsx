import React, { useState } from "react";
import { Text } from "@/components/ui/text";
import { ScrollView, Switch, View } from "react-native";
import { Link, Stack } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import { cn } from "@/lib/utils";

import pkg from "@/package.json";
import { useStore } from "@/stores/mainStore";
import { Input } from "@/components/ui/input";

export default function Settings() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const appviewDid = useStore((state) => state.tealDid);
  const setAppviewDid = useStore((state) => state.setTealDid);

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
        <TextInputRow
          labelText="Appview DID"
          initialValue={appviewDid || ""} // Ensure currentValue is a string
          onSubmit={(e) => setAppviewDid(e)}
          placeholder="Enter your Appview DID (e.g., did:web:...)"
        />
        <Link href="/auth/logoutModal" asChild>
          <Button variant="destructive" size="sm" className="w-max pb-1">
            <Text>Sign out</Text>
          </Button>
        </Link>
        <View>
          <Text className="text-muted-foreground">
            teal.fm amethyst ver. {pkg.version}
          </Text>
          <Text className="text-muted-foreground">
            react native{" "}
            {pkg.dependencies["react-native"]
              .replace("~", "")
              .split(".")
              .slice(0, 2)
              .join(".")}
            , expo {pkg.dependencies.expo.split(".")[0].replace("~", "")}.
          </Text>
        </View>
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
      <Text className="text-base font-semibold">{text}</Text>
      <View className="flex-row items-center justify-around gap-1 w-full bg-muted h-10 px-1 rounded-xl">
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

function TextInputRow({
  labelText,
  initialValue = "", // Added initialValue prop, defaults to empty string
  onSubmit,
  placeholder,
}: {
  labelText: string;
  initialValue?: string; // Made initialValue optional
  onSubmit: (value: string) => void; // onSubmit now takes the string value
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState(initialValue); // Internal state for the input

  const handleSubmit = () => {
    onSubmit(inputValue);
  };

  return (
    <View className="items-start gap-2 pt-2">
      <Text className="text-base font-semibold">{labelText}</Text>
      <View className="flex-row gap-2 w-full items-center">
        <Input
          className="border border-muted-foreground/50 bg-transparent text-foreground h-10 w-full rounded-md px-3 py-2 text-base"
          value={inputValue}
          onChangeText={setInputValue} // Update internal state on change
          placeholder={placeholder}
          placeholderTextColor="hsl(var(--muted-foreground))"
        />
        <Button onPress={handleSubmit} size="sm">
          <Text>Submit</Text>
        </Button>
      </View>
    </View>
  );
}
