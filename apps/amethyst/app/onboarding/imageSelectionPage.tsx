import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { ArrowLeft, ImagePlus, Pen, UserRoundCheck } from "lucide-react-native";

interface ImageSelectionPageProps {
  onComplete: (
    avatarUri: string | undefined,
    bannerUri: string | undefined,
  ) => void;
  initialAvatar?: string;
  initialBanner?: string;
  onBack?: () => void;
}

const ImageSelectionPage: React.FC<ImageSelectionPageProps> = ({
  onComplete,
  initialAvatar,
  initialBanner,
  onBack,
}) => {
  const [avatarUri, setAvatarUri] = useState(initialAvatar || "");
  const [bannerUri, setBannerUri] = useState(initialBanner || "");
  const [loading, setLoading] = useState(false);

  const pickImage = async (
    setType: typeof setAvatarUri | typeof setBannerUri,
  ) => {
    setLoading(true);
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
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
    onComplete(avatarUri || undefined, bannerUri || undefined);
  };

  return (
    <View className="flex-1 justify-between gap-8">
      <View className="gap-5">
        <View className="h-12 w-12 items-center justify-center rounded-lg bg-accent">
          <Icon icon={ImagePlus} size={24} className="text-primary" />
        </View>
        <Text className="font-sans text-3xl font-black">Set the artwork.</Text>
        <Text className="text-base text-muted-foreground">
          Add an avatar and banner, or keep the images from your Bluesky
          profile. Both are optional.
        </Text>
        <Pressable
          onPress={() => pickImage(setBannerUri)}
          className="aspect-[3/1] w-full"
        >
          <View className="relative flex-1 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {loading && !bannerUri && <ActivityIndicator />}
            {bannerUri ? (
              <>
                <Image
                  source={{ uri: bannerUri }}
                  className="h-full w-full rounded-lg object-cover"
                />
                <View className="absolute -bottom-2 -right-2 rounded-full bg-muted/70 p-1">
                  <Icon icon={Pen} size={18} className="fill-white" />
                </View>
              </>
            ) : (
              <Text className="text-muted-foreground">Add banner image</Text>
            )}
          </View>
        </Pressable>
        <Pressable
          onPress={() => pickImage(setAvatarUri)}
          className="self-start"
        >
          <View className="relative">
            {loading && !avatarUri && <ActivityIndicator />}
            <Avatar className="h-24 w-24" alt="User Avatar">
              {avatarUri ? (
                <>
                  <AvatarImage source={{ uri: avatarUri }} />
                <View className="absolute bottom-0 right-0 rounded-full bg-muted/70 p-1">
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
      </View>
      <View className="w-full flex-row justify-between">
        {onBack && (
          <Button variant="outline" onPress={onBack} className="flex-row gap-2">
            <Icon icon={ArrowLeft} size={18} />
            <Text>Back</Text>
          </Button>
        )}
        <Button onPress={handleNext} className="flex-row gap-2">
          <Icon icon={UserRoundCheck} size={18} />
          <Text>Create profile</Text>
        </Button>
      </View>
    </View>
  );
};

export default ImageSelectionPage;
