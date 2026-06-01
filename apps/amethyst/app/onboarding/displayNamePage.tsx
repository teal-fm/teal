import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { ArrowRight, BadgeCheck } from "lucide-react-native";

interface DisplayNamePageProps {
  onComplete: (displayName: string) => void;
  initialDisplayName?: string;
  onBack?: () => void;
}

const DisplayNamePage: React.FC<DisplayNamePageProps> = ({
  onComplete,
  initialDisplayName,
  onBack,
}) => {
  const [displayName, setDisplayName] = useState(initialDisplayName || "");

  const handleNext = () => {
    if (displayName) {
      onComplete(displayName);
    }
  };

  return (
    <View className="flex-1 justify-between gap-10">
      <View className="gap-5">
        <View className="h-12 w-12 items-center justify-center rounded-lg bg-accent">
          <Icon icon={BadgeCheck} size={24} className="text-primary" />
        </View>
        <Text className="font-serif text-3xl font-black">
          What should listeners call you?
        </Text>
        <Text className="text-base text-muted-foreground">
          This is the name shown beside your plays. We started with your Bluesky
          display name when one was available.
        </Text>
        <Input
          className="h-14 rounded-lg border border-border bg-background px-4 text-lg"
          placeholder="Display name"
          value={displayName}
          onChangeText={setDisplayName}
        />
      </View>
      <View className="w-full flex-row justify-end">
        <Button
          onPress={handleNext}
          disabled={!displayName}
          className="min-w-36 flex-row gap-2"
        >
          <Text>Next</Text>
          <Icon icon={ArrowRight} size={18} />
        </Button>
      </View>
    </View>
  );
};

export default DisplayNamePage;
