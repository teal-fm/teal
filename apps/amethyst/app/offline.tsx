import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { CloudOff } from "lucide-react-native";
import { Link, Stack } from "expo-router";

export default function Offline() {
  return (
    <View className="flex-1 justify-center items-center gap-2">
      <Stack.Screen
        options={{
          title: "Can't Connect",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <View className="max-w-md justify-center items-center">
        <Icon icon={CloudOff} size={64} />
        <Text className="text-center">Oups! Can’t connect to teal.fm.</Text>
        <Text className="text-center">
          Try again in a few seconds, or you can change the AppView{" "}
          <Link href="/settings">
            <Text className="text-blue-600 dark:text-blue-400 border-b border-border">
              in Settings
            </Text>
          </Link>
        </Text>
      </View>
    </View>
  );
}
