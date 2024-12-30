import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet } from "react-native";

import { View } from "react-native";
import { Text } from "../components/ui/text";

export default function ModalScreen() {
  return (
    <View className="flex-1 items-center justify-center dark:bg-neutral-800 bg-neutral-100">
      <Text className="text-neutral-200 text-4xl">HELLO WORLD !!!!</Text>
      <Text className="text-neutral-200 text-4xl">./app/modal.tsx</Text>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
    </View>
  );
}
