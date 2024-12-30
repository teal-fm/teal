import React from "react";
import { View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../components/ui/text";
import { Button } from "../components/ui/button";
import { Icon } from "../lib/icons/iconWithClassName";
import { Home, AlertCircle } from "lucide-react-native";
import { Stack, router } from "expo-router";

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
      <View className="flex-1 justify-center align-center p-8 gap-4 pb-32 max-w-screen-sm">
        <View className="flex items-center">
          <Icon icon={AlertCircle} className="color-destructive" size={64} />
        </View>
        <Text className="text-4xl font-semibold text-center text-foreground">
          Oops! Something went wrong
        </Text>
        <Text className="text-center text-muted-foreground">
          We couldn't complete your request. Please try again later.
        </Text>
        <View className="flex flex-row justify-center items-center mt-4">
          <Button className="bg-primary" onPress={() => router.push("/")}>
            <>
              <Text className="font-semibold text-lg">Return Home</Text>
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
