import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const [displayName, setDisplayName] = useState(initialDisplayName || '');

  const handleNext = () => {
    if (displayName) {
      onComplete(displayName);
    }
  };

  return (
    <View className="flex-1 justify-between items-center px-5">
      <View />
      <View className="gap-4 max-w-lg">
        <Text className="text-2xl font-semibold text-center">
          Welcome! What should we call you?
        </Text>
        <Text className="text-sm text-center text-muted-foreground -mt-2">
          Choose something unique, memorable, and something others will easily
          recognise. It can be your real name or a nickname you like.
        </Text>
        <Input
          className="border border-gray-300 rounded px-3 py-2 mb-5"
          placeholder="Your Display Name"
          value={displayName}
          onChangeText={setDisplayName}
        />
      </View>
      <View className="flex-row justify-between w-full">
        {onBack && (
          <Button variant="outline" onPress={onBack} className="flex-1 mr-2">
            <Text>Back</Text>
          </Button>
        )}
        <Button
          onPress={handleNext}
          disabled={!displayName}
          className="flex-1 ml-2"
        >
          <Text>Next</Text>
        </Button>
      </View>
    </View>
  );
};

export default DisplayNamePage;
