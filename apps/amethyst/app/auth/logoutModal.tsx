import { useCallback } from "react";
import { Platform, Pressable, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AuthPageTitle from "@/components/auth/AuthPageTitle";
import { useWebDialog } from "@/components/auth/useWebDialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import { X } from "lucide-react-native";

// should probably be a WebModal component or something?
export default function ModalScreen() {
  // handle log out
  const { logOut } = useStore((state) => state);
  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);
  const dialogRef = useWebDialog(
    handleGoBack,
    "teal-logout-title",
    "/auth/logoutModal",
  );
  return (
    <View className="flex min-h-screen w-full items-center justify-center bg-black/45 px-4">
      <AuthPageTitle path="/auth/logoutModal" title="Sign out" />
      <Pressable
        className="absolute inset-0"
        onPress={handleGoBack}
        accessible={false}
        tabIndex={-1}
      />
      <View
        ref={dialogRef}
        className="relative w-full max-w-96 items-center justify-center gap-4 rounded-2xl bg-background px-7 py-8 shadow-xl"
      >
        <Button
          variant="ghost"
          size="icon"
          accessibilityLabel="Cancel sign out"
          className="absolute right-2 top-2"
          onPress={handleGoBack}
        >
          <Icon icon={X} className="text-muted-foreground" />
        </Button>
        <Text
          nativeID="teal-logout-title"
          className="mt-5 font-sans text-3xl font-black"
        >
          Sign out of Teal?
        </Text>
        <Text className="text-center text-sm leading-5 text-muted-foreground">
          Your profile and listening history stay with your account. You can
          sign in again whenever you like.
        </Text>
        <Button
          onPress={() => {
            logOut();
            // redirect to home
            router.navigate("/");
          }}
        >
          <Text className="text-lg">Sign out</Text>
        </Button>

        {/* Use a light status bar on iOS to account for the black space above the modal */}
        <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
      </View>
    </View>
  );
}
