import React from "react";
import { TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { AlertCircle, Home } from "lucide-react-native";

import { Button } from "../components/ui/button";
import { Text } from "../components/ui/text";
import { Icon } from "../lib/icons/iconWithClassName";

const ErrorScreen = () => {
  return (
    <SafeAreaView className="flex-1">
      <Stack.Screen
        options={{
          title: "Error",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      <View className="align-center max-w-screen-sm flex-1 justify-center gap-4 p-8 pb-32">
        <View className="flex items-center">
          <Icon icon={AlertCircle} className="color-destructive" size={64} />
        </View>
        <Text className="text-center text-4xl font-semibold text-foreground">
          Oops! Something went wrong
        </Text>
        <Text className="text-center text-muted-foreground">
          We couldn't complete your request. Please try again later.
        </Text>
        <View className="mt-4 flex flex-row items-center justify-center">
          <Button className="bg-primary" onPress={() => router.push("/")}>
            <>
              <Text className="text-lg font-semibold">Return Home</Text>
              <Icon icon={Home} />
            </>
          </Button>
        </View>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-md text-center text-secondary">Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ErrorScreen;
