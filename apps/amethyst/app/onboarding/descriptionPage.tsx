import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/lib/icons/iconWithClassName";
import { ArrowLeft, ArrowRight, MessageSquareText } from "lucide-react-native";

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
    onComplete(description);
  };

  return (
    <View className="flex-1 justify-between gap-10">
      <View className="gap-5">
        <View className="h-12 w-12 items-center justify-center rounded-lg bg-accent">
          <Icon icon={MessageSquareText} size={24} className="text-primary" />
        </View>
        <Text className="font-sans text-3xl font-black">
          Add a liner note.
        </Text>
        <Text className="text-base text-muted-foreground">
          Say a little about your listening life, or leave this blank for now.
        </Text>
        <Textarea
          className="min-h-[170px] rounded-lg border border-border bg-background px-4 py-3 text-base"
          placeholder="What keeps ending up in your headphones?"
          multiline
          value={description}
          onChangeText={setDescription}
        />
      </View>
      <View className="w-full flex-row justify-between">
        {onBack && (
          <Button variant="outline" onPress={onBack} className="flex-row gap-2">
            <Icon icon={ArrowLeft} size={18} />
            <Text>Back</Text>
          </Button>
        )}
        <Button onPress={handleComplete} className="flex-row gap-2">
          <Text>{description ? "Next" : "Skip for now"}</Text>
          <Icon icon={ArrowRight} size={18} />
        </Button>
      </View>
    </View>
  );
};

export default DescriptionPage;
