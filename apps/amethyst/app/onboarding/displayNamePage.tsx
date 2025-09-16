import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

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
    <View className="flex-1 items-center justify-between px-5">
      <View />
      <View className="max-w-lg gap-4">
        <Text className="text-center text-2xl font-semibold">
          Welcome! What should we call you?
        </Text>
        <Text className="-mt-2 text-center text-sm text-muted-foreground">
          Choose something unique, memorable, and something others will easily
          recognise. It can be your real name or a nickname you like.
        </Text>
        <Input
          className="mb-5 rounded border border-gray-300 px-3 py-2"
          placeholder="Your Display Name"
          value={displayName}
          onChangeText={setDisplayName}
        />
      </View>
      <View className="w-full flex-row justify-between">
        {onBack && (
          <Button variant="outline" onPress={onBack} className="mr-2 flex-1">
            <Text>Back</Text>
          </Button>
        )}
        <Button
          onPress={handleNext}
          disabled={!displayName}
          className="ml-2 flex-1"
        >
          <Text>Next</Text>
        </Button>
      </View>
    </View>
  );
};

export default DisplayNamePage;
