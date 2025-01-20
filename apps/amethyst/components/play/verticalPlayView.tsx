import { View, Image, Text } from "react-native";

export default function VerticalPlayView({
  releaseMbid,
  trackTitle,
  artistName,
  releaseTitle,
}: {
  releaseMbid: string;
  trackTitle: string;
  artistName?: string;
  releaseTitle?: string;
}) {
  return (
    <View className="flex flex-col items-center">
      <Image
        className="w-48 h-48 rounded-lg bg-gray-500/50 mb-2"
        source={{
          uri: `https://coverartarchive.org/release/${releaseMbid}/front-250`,
        }}
      />
      <Text className="text-xl text-center">{trackTitle}</Text>
      {artistName && (
        <Text className="text-lg text-gray-500 text-center">{artistName}</Text>
      )}
      {releaseTitle && (
        <Text className="text-lg text-gray-500 text-center">
          {releaseTitle}
        </Text>
      )}
    </View>
  );
}
