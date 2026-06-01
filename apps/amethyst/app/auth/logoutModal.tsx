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
      <View className="relative max-h-72 w-full max-w-96 flex-1 items-center justify-center gap-3 rounded-lg border border-border bg-background px-7 shadow-xl">
        <Icon
          icon={X}
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          name="x"
        />
        <Text className="font-serif text-3xl font-black">
          Sign out of Teal?
        </Text>
        <Text className="text-center text-sm leading-5 text-muted-foreground">
          Your records stay in your ATProto repository. This only clears your
          local session.
        </Text>
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
