import { Record as Play } from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";
import { View, Image, Text } from "react-native";

const PlayView = ({ play }: { play: Play }) => {
  return (
    <View className="flex flex-row gap-2 max-w-full">
      <Image
        className="w-20 h-20 rounded-lg bg-gray-500/50"
        source={{
          uri: `https://coverartarchive.org/release/${play.releaseMbId}/front-250`,
        }}
      />
      <View className="shrink">
        <Text className="text-lg text-foreground line-clamp-1 overflow-ellipsis">
          {play.trackName}
        </Text>
        {play.artistNames && (
          <Text className="text-lg text-left text-muted-foreground">
            {play.artistNames.join(", ")}
          </Text>
        )}
        {play.releaseName && (
          <Text className="text-left text-muted-foreground line-clamp-1 overflow-ellipsis">
            {play.releaseName}
          </Text>
        )}
      </View>
    </View>
  );
};

export default PlayView;
