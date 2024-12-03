import { View, Image } from "react-native";
import { Text } from "~/components/ui/text";

export default function TabTwoScreen() {
  return (
    <View className="flex-1 flex gap-2 items-center justify-center align-center w-full h-full bg-background">
      <Text className="text-3xl">oh honey honey honey pie alya</Text>
      <Image
        style={{
          height: 200,
          width: 200,
        }}
        source={require("../../assets/images/honeypie_alya.png")}
      />
      <Text className="font-serif-old">Alisa Mikhailovna Kujou</Text>
    </View>
  );
}
