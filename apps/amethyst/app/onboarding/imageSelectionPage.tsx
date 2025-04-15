import React, { useState } from 'react';
import { View, Pressable, Image, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/lib/icons/iconWithClassName';
import { Pen } from 'lucide-react-native';

interface ImageSelectionPageProps {
  onComplete: (avatarUri: string, bannerUri: string) => void;
  initialAvatar?: string;
  initialBanner?: string;
}

const ImageSelectionPage: React.FC<ImageSelectionPageProps> = ({
  onComplete,
  initialAvatar,
  initialBanner,
}) => {
  const [avatarUri, setAvatarUri] = useState(initialAvatar || '');
  const [bannerUri, setBannerUri] = useState(initialBanner || '');
  const [loading, setLoading] = useState(false);

  const pickImage = async (
    setType: typeof setAvatarUri | typeof setBannerUri,
  ) => {
    setLoading(true);
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: setType === setAvatarUri ? [1, 1] : [3, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setType(result.assets[0].uri);
    }
    setLoading(false);
  };
  const handleNext = () => {
    if (avatarUri && bannerUri) {
      onComplete(avatarUri, bannerUri);
    }
  };

  return (
    <View className="flex-1 justify-center items-center h-screen min-h-full px-5">
      <Text className="text-2xl font-bold mb-5 text-center">
        What do you look like?
      </Text>
      <Pressable
        onPress={() => pickImage(setBannerUri)}
        className="w-full aspect-[3/1] mb-5"
      >
        <View className="flex-1 bg-gray-200 rounded-lg justify-center items-center relative">
          {loading && !bannerUri && <ActivityIndicator />}
          {bannerUri ? (
            <>
              <Image
                source={{ uri: bannerUri }}
                className="w-full h-full rounded-lg object-cover"
              />
              <View className="absolute -bottom-2 -right-2 bg-gray-500/50 rounded-full p-1">
                <Icon icon={Pen} size={18} className="fill-white" />
              </View>
            </>
          ) : (
            <Text className="text-gray-500">Add Banner Image</Text>
          )}
        </View>
      </Pressable>
      <Pressable onPress={() => pickImage(setAvatarUri)} className="mb-10">
        <View className="relative">
          {loading && !avatarUri && <ActivityIndicator />}
          <Avatar className="w-24 h-24" alt="User Avatar">
            {avatarUri ? (
              <>
                <AvatarImage source={{ uri: avatarUri }} />
                <View className="absolute bottom-0 right-0 bg-gray-500/50 rounded-full p-1">
                  <Icon icon={Pen} size={18} className="fill-white" />
                </View>
              </>
            ) : (
              <AvatarFallback>
                <Text>?</Text>
              </AvatarFallback>
            )}
          </Avatar>
        </View>
      </Pressable>

      <Button
        onPress={handleNext}
        disabled={!avatarUri || !bannerUri}
        className="w-full"
      >
        <Text>Next</Text>
      </Button>
    </View>
  );
};

export default ImageSelectionPage;
