import { Platform, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import { X } from "lucide-react-native";

// should probably be a WebModal component or something?
export default function ModalScreen() {
  // handle log out
  const { logOut } = useStore((state) => state);
  const handleGoBack = () => {
    router.back();
  };
  return (
    <TouchableOpacity
      className="flex h-screen w-full items-center justify-center bg-muted/60 backdrop-blur-sm animate-in fade-in"
      onPress={() => handleGoBack()}
    >
      <View className="relative max-h-80 w-full max-w-96 flex-1 items-center justify-center gap-2 rounded-xl bg-background shadow-xl">
        <Icon
          icon={X}
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          name="x"
        />
        <Text className="text-4xl">Surprise!</Text>
        <Text className="text-xl">You can sign out here!</Text>
        <Text className="-mt-2 text-xl">but... are you sure?</Text>
        <Button
          onPress={() => {
            logOut();
            // redirect to home
            router.navigate("/");
          }}
        >
          <Text className="text-lg">Sign Out</Text>
        </Button>

        {/* Use a light status bar on iOS to account for the black space above the modal */}
        <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
      </View>
    </TouchableOpacity>
  );
}
