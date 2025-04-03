import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Icon } from '@/lib/icons/iconWithClassName';
import { CheckCircle } from 'lucide-react-native';

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
  const [description, setDescription] = useState(initialDescription || '');

  const handleComplete = () => {
    if (description) {
      onComplete(description);
    }
  };

  return (
    <View className="flex-1 justify-between items-center px-5">
      <View />
      <View className="gap-4 max-w-lg">
        <Text className="text-2xl font-semibold text-center">
          Tell us about yourself!
        </Text>
        <Text className="text-sm text-center text-muted-foreground -mt-2">
          Your bio is your chance to shine. Let your creativity flow and tell
          the world who you are. You can always edit it later.
        </Text>
        <Textarea
          className="border border-gray-300 rounded px-3 py-2 mb-5 min-h-[150px]"
          placeholder="A short bio or description"
          multiline
          value={description}
          onChangeText={setDescription}
        />
      </View>
      <View className="flex-row justify-between w-full">
        {onBack && (
          <Button variant="outline" onPress={onBack} className="flex-1 mr-2">
            <Text>Back</Text>
          </Button>
        )}
        <Button
          onPress={handleComplete}
          disabled={!description}
          className="flex-1 ml-2"
        >
          <Text>Next</Text>{' '}
          <Icon icon={CheckCircle} size={18} className="ml-2" />
        </Button>
      </View>
    </View>
  );
};

export default DescriptionPage;
