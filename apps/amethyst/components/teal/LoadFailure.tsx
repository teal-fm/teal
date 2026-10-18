import { View } from "react-native";
import { Link } from "expo-router";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function LoadFailure({
  title,
  description = "Please try again, or find something else in Explore.",
  onRetry,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <View
      role="alert"
      className="mb-5 gap-3 rounded-lg border border-border bg-card p-4"
    >
      <Text role="heading" aria-level={2} className="text-lg font-bold">
        {title}
      </Text>
      <Text className="text-sm leading-6 text-muted-foreground">
        {description}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {onRetry && (
          <Button onPress={onRetry}>
            <Text>Try again</Text>
          </Button>
        )}
        <Link href="/search" asChild>
          <Button variant="outline">
            <Text>Explore music</Text>
          </Button>
        </Link>
      </View>
    </View>
  );
}
