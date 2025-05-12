import { Image, View } from "react-native";
import { Text } from "@/components/ui/text";
import { timeAgo } from "@/lib/utils";

export default function PlayView({
  releaseMbid,
  trackTitle,
  artistName,
  dateListened,
}: {
  releaseMbid?: string;
  trackTitle: string;
  artistName?: string;
  dateListened?: Date;
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
          <Text className="text-sm text-left text-foreground line-clamp-1 overflow-ellipsis">
            {artistName}
          </Text>
        )}
        {dateListened && (
          <Text className="text-sm text-left text-muted-foreground line-clamp-1 overflow-ellipsis">
            played {timeAgo(dateListened)}
          </Text>
        )}
      </View>
    </View>
  );
}
