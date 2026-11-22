import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { pickProfileImage, type ProfileImageSlot, type SelectedProfileImage } from "@/lib/profileImage";
import { Pen } from "lucide-react-native";

interface ImageSelectionPageProps {
  onComplete: () => void;
  avatarUri?: string;
  bannerUri?: string;
  onPickAvatar: (image: SelectedProfileImage) => void;
  onPickBanner: (image: SelectedProfileImage) => void;
  onUndoAvatar?: () => void;
  onUndoBanner?: () => void;
}

const ImageSelectionPage: React.FC<ImageSelectionPageProps> = ({
  onComplete,
  avatarUri,
  bannerUri,
  onPickAvatar,
  onPickBanner,
  onUndoAvatar,
  onUndoBanner,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pickImage = async (target: ProfileImageSlot) => {
    setError("");
    setLoading(true);
    try {
      const asset = await pickProfileImage(ImagePicker.launchImageLibraryAsync, target);
      if (asset) {
        const onPick = target === "avatar" ? onPickAvatar : onPickBanner;
        onPick(asset);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn't open the image picker.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="h-screen min-h-full flex-1 items-center justify-center px-5">
      <Text className="mb-5 text-center text-2xl font-bold">
        What do you look like?
      </Text>
      <Pressable
        onPress={() => pickImage("banner")}
        className="mb-5 aspect-[3/1] w-full"
      >
        <View className="relative flex-1 items-center justify-center rounded-lg bg-gray-200">
          {loading && !bannerUri && <ActivityIndicator />}
          {bannerUri ? (
            <>
              <Image
                source={{ uri: bannerUri }}
                className="h-full w-full rounded-lg object-cover"
              />
              <View className="absolute -bottom-2 -right-2 rounded-full bg-gray-500/50 p-1">
                <Icon icon={Pen} size={18} className="fill-white" />
              </View>
            </>
          ) : (
            <Text className="text-gray-500">Add Banner Image</Text>
          )}
        </View>
      </Pressable>
      <Pressable onPress={() => pickImage("avatar")} className="mb-10">
        <View className="relative">
          {loading && !avatarUri && <ActivityIndicator />}
          <Avatar className="h-24 w-24" alt="User Avatar">
            {avatarUri ? (
              <>
                <AvatarImage source={{ uri: avatarUri }} />
                <View className="absolute bottom-0 right-0 rounded-full bg-gray-500/50 p-1">
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

      {onUndoAvatar && (
        <Button
          variant="link"
          disabled={loading}
          onPress={() => {
            setError("");
            onUndoAvatar();
          }}
        >
          <Text>Undo avatar change</Text>
        </Button>
      )}
      {onUndoBanner && (
        <Button
          variant="link"
          disabled={loading}
          onPress={() => {
            setError("");
            onUndoBanner();
          }}
        >
          <Text>Undo banner change</Text>
        </Button>
      )}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Button onPress={onComplete} disabled={loading} className="w-full">
        <Text>Next</Text>
      </Button>
    </View>
  );
};

export default ImageSelectionPage;
