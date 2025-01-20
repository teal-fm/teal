import { ExternalLink } from "@/components/ExternalLink";
import { PlaySubmittedData } from "@/lib/oldStamp";
import { useLocalSearchParams } from "expo-router";
import { Check, ExternalLinkIcon } from "lucide-react-native";
import { View, Text } from "react-native";

export default function StepThree() {
  const { submittedData } = useLocalSearchParams();
  const responseData: PlaySubmittedData = JSON.parse(submittedData as string);
  return (
    <View className="flex-1 p-4 bg-background items-center h-screen-safe">
      <View className="flex justify-center items-center gap-2 max-w-screen-md w-screen min-h-full px-4">
        <Check size={48} className="text-green-600 dark:text-green-400" />
        <Text className="text-xl">Play Submitted!</Text>
        <Text>
          You can view your play{" "}
          <ExternalLink
            className="text-blue-600 dark:text-blue-400"
            href={`https://pdsls.dev/${responseData.playAtUrl}`}
          >
            on PDSls
          </ExternalLink>
          <ExternalLinkIcon className="inline mb-0.5 ml-0.5" size="1rem" />
        </Text>
        {responseData.blueskyPostUrl && (
          <Text>
            Or you can{" "}
            <ExternalLink
              className="text-blue-600 dark:text-blue-400"
              href={`https://pdsls.dev/`}
            >
              view your Bluesky post.
            </ExternalLink>
          </Text>
        )}
      </View>
    </View>
  );
}
