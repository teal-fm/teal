import * as React from "react";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Touchable,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useOnEscape } from "@/hooks/useOnEscape";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { Icon } from "@/lib/icons/iconWithClassName";
import { pickProfileImage, type ProfileImageSlot, type SelectedProfileImage } from "@/lib/profileImage";
import { cn } from "@/lib/utils";
import { Pen } from "lucide-react-native";

import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

const GITHUB_AVATAR_URI =
  "https://i.pinimg.com/originals/ef/a2/8d/efa28d18a04e7fa40ed49eeb0ab660db.jpg";

export interface EditProfileModalProps {
  onClose: () => void;
  profile: any; // Pass the profile data as a prop
  onSave: (
    profile: any,
    avatar?: SelectedProfileImage,
    banner?: SelectedProfileImage,
  ) => Promise<void>;
}

export default function EditProfileModal({
  onClose,
  profile, // Pass the profile data as a prop
  onSave, // Pass the onSave callback function
}: EditProfileModalProps) {
  const [editedProfile, setEditedProfile] = useState({ ...profile });
  const [avatar, setAvatar] = useState<SelectedProfileImage>();
  const [banner, setBanner] = useState<SelectedProfileImage>();
  const avatarUri =
    avatar?.uri ??
    getImageCdnLink({ did: profile?.did, hash: profile?.avatar });
  const bannerUri =
    banner?.uri ??
    getImageCdnLink({ did: profile?.did, hash: profile?.banner });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickImage = async (target: ProfileImageSlot) => {
    setError("");
    setLoading(true);
    try {
      const asset = await pickProfileImage(ImagePicker.launchImageLibraryAsync, target);
      if (asset) {
        if (target === "avatar") setAvatar(asset);
        else setBanner(asset);
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

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      await onSave(editedProfile, avatar, banner);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Couldn't save the profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  useOnEscape(onClose);

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center gap-5 bg-background p-6">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Modal animationType="fade" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={() => onClose()}>
        <View className="flex-1 items-center justify-center bg-black/50 backdrop-blur">
          <TouchableWithoutFeedback>
            <Card className="w-11/12 max-w-md rounded-lg bg-card p-4">
              <Text className="mb-4 text-xl font-bold">Edit Profile</Text>
              <Pressable onPress={() => pickImage("banner")} disabled={loading || saving}>
                {loading && !bannerUri && <ActivityIndicator />}
                {bannerUri ? (
                  <View className="group relative">
                    <Image
                      source={{ uri: bannerUri }}
                      className="h-24 w-full rounded-lg"
                    />
                    <View className="absolute -bottom-2 -right-2 rounded-full border border-border bg-muted/70 p-1 text-foreground transition-colors duration-300 group-hover:bg-muted/90">
                      <Icon icon={Pen} size={18} className="fill-muted" />
                    </View>
                  </View>
                ) : (
                  <View className="-mb-6 h-32 w-full max-w-[100vh] rounded-xl bg-muted md:h-44" />
                )}
              </Pressable>

              <Pressable
                onPress={() => pickImage("avatar")}
                disabled={loading || saving}
                className={cn("group relative mb-4", bannerUri && "-mt-8 pl-4")}
              >
                {loading && !avatarUri && <ActivityIndicator />}
                <View className="group relative w-min">
                  <Avatar
                    className="h-20 w-20"
                    alt={`Avatar for ${editedProfile?.displayName ?? "User"}`}
                  >
                    <AvatarImage source={{ uri: avatarUri }} />
                    <AvatarFallback>
                      <Text>
                        {editedProfile?.displayName?.substring(0, 1) ?? "R"}
                      </Text>
                    </AvatarFallback>
                  </Avatar>
                  <View className="absolute bottom-0 right-0 rounded-full border border-border bg-muted/70 p-1 text-foreground transition-colors duration-300 group-hover:bg-muted/90">
                    <Icon icon={Pen} size={18} className="fill-muted" />
                  </View>
                </View>
              </Pressable>

              {avatar && (
                <Button
                  variant="link"
                  disabled={loading || saving}
                  onPress={() => {
                    setAvatar(undefined);
                    setError("");
                  }}
                >
                  <Text>Undo avatar change</Text>
                </Button>
              )}
              {banner && (
                <Button
                  variant="link"
                  disabled={loading || saving}
                  onPress={() => {
                    setBanner(undefined);
                    setError("");
                  }}
                >
                  <Text>Undo banner change</Text>
                </Button>
              )}
              <Text className="pl-1 text-sm font-semibold text-muted-foreground">
                Display Name
              </Text>
              <Input
                className="mb-4 rounded border border-gray-300 px-3 py-2"
                placeholder="Display Name"
                value={editedProfile.displayName}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, displayName: text })
                }
              />
              <Text className="pl-1 text-sm font-semibold text-muted-foreground">
                Description
              </Text>
              <Textarea
                className="mb-4 rounded border border-gray-300 px-3 py-2"
                placeholder="Description"
                multiline
                value={editedProfile.description}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, description: text })
                }
              />
              {error ? <Text accessibilityRole="alert">{error}</Text> : null}
              <View className="flex-row justify-between">
                <Button variant="outline" onPress={onClose}>
                  <Text>Cancel</Text>
                </Button>
                <Button onPress={handleSave} disabled={saving || loading}>
                  <Text>Save</Text>
                </Button>
              </View>
            </Card>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
