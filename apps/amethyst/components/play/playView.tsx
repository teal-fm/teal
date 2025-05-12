import { Image, View } from "react-native";
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
    <View className="flex max-w-full flex-row gap-2">
      <Image
        className="h-16 w-16 rounded-lg bg-gray-500/50"
        source={{
          uri:
            releaseMbid &&
            `https://coverartarchive.org/release/${releaseMbid}/front-250`,
        }}
      />
      <View className="flex shrink flex-col justify-center">
        <Text className="-mt-0.5 line-clamp-1 overflow-ellipsis text-foreground">
          {trackTitle}
        </Text>
        {artistName && (
          <Text className="line-clamp-1 overflow-ellipsis text-left text-muted-foreground">
            {artistName}
          </Text>
        )}
        {releaseTitle && (
          <Text className="line-clamp-1 overflow-ellipsis text-left text-sm text-muted-foreground">
            {releaseTitle}
          </Text>
        )}
      </View>
    </View>
  );
}
