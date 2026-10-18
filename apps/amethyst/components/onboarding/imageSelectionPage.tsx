import React, { useEffect, useRef, useState } from "react";
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
  onBack?: (avatar?: string, banner?: string) => void;
  error?: string;
}

const ImageSelectionPage: React.FC<ImageSelectionPageProps> = ({
  onComplete,
  initialAvatar,
  initialBanner,
  onBack,
  error,
}) => {
  const [avatarUri, setAvatarUri] = useState(initialAvatar || "");
  const [bannerUri, setBannerUri] = useState(initialBanner || "");
  const [loading, setLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string>();
  const avatarEdited = useRef(false);
  const bannerEdited = useRef(false);
  useEffect(() => {
    if (!avatarEdited.current) setAvatarUri(initialAvatar || "");
  }, [initialAvatar]);
  useEffect(() => {
    if (!bannerEdited.current) setBannerUri(initialBanner || "");
  }, [initialBanner]);

  const pickImage = async (
    setType: typeof setAvatarUri | typeof setBannerUri,
  ) => {
    if (loading) return;
    setLoading(true);
    setPickerError(undefined);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: setType === setAvatarUri ? [1, 1] : [3, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        if (setType === setAvatarUri) avatarEdited.current = true;
        else bannerEdited.current = true;
        setType(result.assets[0].uri);
      }
    } catch {
      setPickerError(
        "Couldn't open your images. Try again or continue without artwork.",
      );
    } finally {
      setLoading(false);
    }
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
          profile. Both are optional. Use PNG or JPEG images of 1 MB or less.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            bannerUri ? "Change banner image" : "Add banner image"
          }
          disabled={loading}
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
        {bannerUri && (
          <Button
            variant="ghost"
            className="self-start"
            onPress={() => {
              bannerEdited.current = true;
              setBannerUri("");
            }}
          >
            <Text>Remove banner</Text>
          </Button>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            avatarUri ? "Change avatar image" : "Add avatar image"
          }
          disabled={loading}
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
        {avatarUri && (
          <Button
            variant="ghost"
            className="self-start"
            onPress={() => {
              avatarEdited.current = true;
              setAvatarUri("");
            }}
          >
            <Text>Remove avatar</Text>
          </Button>
        )}
        {(error || pickerError) && (
          <Text accessibilityRole="alert" className="text-destructive">
            {error || pickerError} Your name and bio are still here. Retry or
            remove the image to continue.
          </Text>
        )}
      </View>
      <View className="w-full flex-row justify-between gap-3">
        {onBack && (
          <Button
            variant="outline"
            onPress={() =>
              onBack(avatarUri || undefined, bannerUri || undefined)
            }
            className="flex-row gap-2"
          >
            <Icon icon={ArrowLeft} size={18} />
            <Text>Back</Text>
          </Button>
        )}
        <Button
          disabled={loading}
          onPress={handleNext}
          className="flex-row gap-2"
        >
          <Icon icon={UserRoundCheck} size={18} />
          <Text>Create profile</Text>
        </Button>
      </View>
    </View>
  );
};

export default ImageSelectionPage;
