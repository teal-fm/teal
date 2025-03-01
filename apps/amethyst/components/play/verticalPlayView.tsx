import { View, Image } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils"; // Assuming you have a utils file with cn function like in shadcn

type VerticalPlayViewProps = {
  releaseMbid: string;
  trackTitle: string;
  artistName?: string;
  releaseTitle?: string;
  size?: "default" | "sm" | "md" | "lg"; // Add size variant
};

export default function VerticalPlayView({
  releaseMbid,
  trackTitle,
  artistName,
  releaseTitle,
  size = "default", // Default size is 'default'
}: VerticalPlayViewProps) {
  // Define sizes for different variants
  const imageSizes = {
    default: "w-48 h-48",
    sm: "w-32 h-32",
    md: "w-48 h-48",
    lg: "w-64 h-64",
  };

  const textSizes = {
    default: "text-xl",
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  };

  const secondaryTextSizes = {
    default: "text-lg",
    sm: "text-sm",
    md: "text-xl",
    lg: "text-xl",
  };

  const marginBottoms = {
    default: "mb-2",
    sm: "mb-1",
    md: "mb-2",
    lg: "mb-4",
  };

  return (
    <View className="flex flex-col items-center">
      <Image
        className={cn(
          imageSizes[size], // Apply image size based on variant
          "rounded-lg bg-gray-500/50",
          marginBottoms[size], // Apply margin bottom based on variant
        )}
        source={{
          uri: `https://coverartarchive.org/release/${releaseMbid}/front-250`,
        }}
      />
      <Text className={cn(textSizes[size], "text-center")}>{trackTitle}</Text>{" "}
      {/* Apply main text size based on variant */}
      {artistName && (
        <Text
          className={cn(
            secondaryTextSizes[size],
            "text-muted-foreground text-center",
          )}
        >
          {artistName}
        </Text>
      )}
      {releaseTitle && (
        <Text
          className={cn(
            secondaryTextSizes[size],
            "text-muted-foreground text-center",
          )}
        >
          {releaseTitle}
        </Text>
      )}
    </View>
  );
}
