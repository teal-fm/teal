import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/lib/icons/iconWithClassName";
import { CheckCircle } from "lucide-react-native";

interface DescriptionPageProps {
  onComplete: (description: string) => void;
  initialDescription?: string;
  onBack?: () => void;
}

const DescriptionPage: React.FC<DescriptionPageProps> = ({
  onComplete,
  initialDescription,
  onBack,
}) => {
  const [description, setDescription] = useState(initialDescription || "");

  const handleComplete = () => {
    if (description) {
      onComplete(description);
    }
  };

  return (
    <View className="flex-1 items-center justify-between px-5">
      <View />
      <View className="max-w-lg gap-4">
        <Text className="text-center text-2xl font-semibold">
          Tell us about yourself!
        </Text>
        <Text className="-mt-2 text-center text-sm text-muted-foreground">
          Your bio is your chance to shine. Let your creativity flow and tell
          the world who you are. You can always edit it later.
        </Text>
        <Textarea
          className="mb-5 min-h-[150px] rounded border border-gray-300 px-3 py-2"
          placeholder="A short bio or description"
          multiline
          value={description}
          onChangeText={setDescription}
        />
      </View>
      <View className="w-full flex-row justify-between">
        {onBack && (
          <Button variant="outline" onPress={onBack} className="mr-2 flex-1">
            <Text>Back</Text>
          </Button>
        )}
        <Button
          onPress={handleComplete}
          disabled={!description}
          className="ml-2 flex-1"
        >
          <Text>Next</Text>{" "}
          <Icon icon={CheckCircle} size={18} className="ml-2" />
        </Button>
      </View>
    </View>
  );
};

export default DescriptionPage;
