import { View, Image } from "react-native";
import { Text } from "@/components/ui/text";

export default function PlayView({
  releaseMbid,
  trackTitle,
  artistName,
  releaseTitle,
}: {
  releaseMbid?: string;
  trackTitle: string;
  artistName?: string;
  releaseTitle?: string;
}) {
  return (
    <View className="flex flex-row gap-2 max-w-full">
      <Image
        className="w-16 h-16 rounded-lg bg-gray-500/50"
        source={{
          uri:
            releaseMbid &&
            `https://coverartarchive.org/release/${releaseMbid}/front-250`,
        }}
      />
      <View className="shrink flex flex-col justify-center">
        <Text className=" text-foreground line-clamp-1 overflow-ellipsis -mt-0.5">
          {trackTitle}
        </Text>
        {artistName && (
          <Text className=" text-left text-muted-foreground line-clamp-1 overflow-ellipsis">
            {artistName}
          </Text>
        )}
        {releaseTitle && (
          <Text className="text-sm text-left text-muted-foreground line-clamp-1 overflow-ellipsis">
            {releaseTitle}
          </Text>
        )}
      </View>
    </View>
  );
}
