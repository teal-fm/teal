import { StatusBar } from "expo-status-bar";
import { Platform, TouchableOpacity } from "react-native";

import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { useStore } from "@/stores/mainStore";
import { Button } from "@/components/ui/button";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { Icon } from "@/lib/icons/iconWithClassName";

// should probably be a WebModal component or something?
export default function ModalScreen() {
  // handle log out
  const { logOut } = useStore((state) => state);
  const handleGoBack = () => {
    router.back();
  };
  return (
    <TouchableOpacity
      className="flex relative justify-center items-center bg-muted-foreground/60 w-screen h-screen backdrop-blur-sm"
      onPress={() => handleGoBack()}
    >
      <Icon icon={X} className="top-2 right-2 absolute" name="x" />
      <View className="flex-1 items-center justify-center gap-2 bg-background w-full max-w-96 max-h-80 shadow-xl rounded-xl">
        <Text className="text-4xl">Surprise!</Text>
        <Text className="text-xl">You can sign out here!</Text>
        <Button
          onPress={() => {
            logOut();
            // redirect to home
            router.navigate("/");
          }}
        >
          <Text className="font-semibold text-lg">Sign out</Text>
        </Button>

        {/* Use a light status bar on iOS to account for the black space above the modal */}
        <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
      </View>
    </TouchableOpacity>
  );
}
