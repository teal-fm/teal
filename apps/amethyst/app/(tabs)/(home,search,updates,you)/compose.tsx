import { Pressable, ScrollView, View } from "react-native";
import { router, Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "@/components/ds";
import SocialComposer from "@/components/teal/SocialComposer";
import { Text } from "@/components/ui/text";

/** Post a song: what you're hearing plus a few words. Opens as a sheet on phones. */
export default function Compose() {
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View className="flex-1 bg-ground">
      <Stack.Screen options={{ title: "Post a song", presentation: "modal" }} />
      <ScrollView
        contentContainerClassName="mx-auto w-full max-w-[640px] gap-4 px-4 pb-10"
        contentContainerStyle={{ paddingTop: insets.top + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between">
          <Pressable onPress={close} accessibilityRole="button" className="h-11 justify-center">
            <Text className="text-[17px] text-tint">Cancel</Text>
          </Pressable>
          <Text role="heading" aria-level={1} className="text-[17px] font-semibold text-ink">
            Post a song
          </Text>
          <View className="w-14" />
        </View>
        <Glass strong className="p-4">
          <SocialComposer
            allowTrackChange
            onPublished={() => {
              void client.invalidateQueries({ queryKey: ["feed"] });
              close();
            }}
          />
        </Glass>
      </ScrollView>
    </View>
  );
}
