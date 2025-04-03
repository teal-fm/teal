import * as React from 'react';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Image,
  ActivityIndicator,
  Touchable,
  TouchableWithoutFeedback,
} from 'react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cn } from '@/lib/utils';
import { useOnEscape } from '@/hooks/useOnEscape';
import { Icon } from '@/lib/icons/iconWithClassName';
import { Pen } from 'lucide-react-native';
import getImageCdnLink from '@/lib/atp/getImageCdnLink';

const GITHUB_AVATAR_URI =
  'https://i.pinimg.com/originals/ef/a2/8d/efa28d18a04e7fa40ed49eeb0ab660db.jpg';

export interface EditProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
  profile: any; // Pass the profile data as a prop
  onSave: (profile: any, avatarUri: string, bannerUri: string) => void; // Pass the onSave callback function
}

export default function EditProfileModal({
  isVisible,
  onClose,
  profile, // Pass the profile data as a prop
  onSave, // Pass the onSave callback function
}: EditProfileModalProps) {
  const [editedProfile, setEditedProfile] = useState({ ...profile });
  const [avatarUri, setAvatarUri] = useState(profile?.avatar);
  const [bannerUri, setBannerUri] = useState(profile?.banner);
  const [loading, setLoading] = useState(false);

  const pickImage = async (
    setType: typeof setAvatarUri | typeof setBannerUri,
  ) => {
    setLoading(true); // Start loading

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: setType === setAvatarUri ? [1, 1] : [3, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setType(result.assets[0].uri);
    }

    setLoading(false); // Stop loading
  };

  const handleSave = () => {
    onSave(editedProfile, avatarUri, bannerUri); // Call the onSave callback with updated data
    //onClose();
  };

  useOnEscape(onClose);

  if (!profile) {
    return (
      <View className="flex-1 justify-center items-center gap-5 p-6 bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Modal animationType="fade" transparent={true} visible={isVisible}>
      <TouchableWithoutFeedback onPress={() => onClose()}>
        <View className="flex-1 justify-center items-center bg-black/50 backdrop-blur">
          <TouchableWithoutFeedback>
            <Card className="bg-card rounded-lg p-4 w-11/12 max-w-md">
              <Text className="text-xl font-bold mb-4">Edit Profile</Text>
              <Pressable onPress={() => pickImage(setBannerUri)}>
                {loading && !bannerUri && <ActivityIndicator />}
                {bannerUri ? (
                  <View className="relative group">
                    <Image
                      source={{
                        uri: bannerUri?.includes(';')
                          ? bannerUri
                          : getImageCdnLink({
                              did: editedProfile.did,
                              hash: bannerUri,
                            }),
                      }}
                      className="w-full h-24 rounded-lg"
                    />
                    <View className="absolute -right-2 -bottom-2 rounded-full bg-muted/70 group-hover:bg-muted/90 text-foreground transition-colors duration-300 border border-border p-1">
                      <Icon icon={Pen} size={18} className="fill-muted" />
                    </View>
                  </View>
                ) : (
                  <View className="w-full max-w-[100vh] h-32 md:h-44 rounded-xl -mb-6 bg-muted" />
                )}
              </Pressable>

              <Pressable
                onPress={() => pickImage(setAvatarUri)}
                className={cn('mb-4 relative group', bannerUri && 'pl-4 -mt-8')}
              >
                {loading && !avatarUri && <ActivityIndicator />}
                <View className="relative group w-min">
                  <Avatar
                    className="w-20 h-20"
                    alt={`Avatar for ${editedProfile?.displayName ?? 'User'}`}
                  >
                    <AvatarImage
                      source={{
                        uri: avatarUri?.includes(';')
                          ? avatarUri
                          : getImageCdnLink({
                              did: editedProfile.did,
                              hash: avatarUri,
                            }),
                      }}
                    />
                    <AvatarFallback>
                      <Text>
                        {editedProfile?.displayName?.substring(0, 1) ?? 'R'}
                      </Text>
                    </AvatarFallback>
                  </Avatar>
                  <View className="absolute right-0 bottom-0 rounded-full bg-muted/70 group-hover:bg-muted/90 text-foreground transition-colors duration-300 border border-border p-1">
                    <Icon icon={Pen} size={18} className="fill-muted" />
                  </View>
                </View>
              </Pressable>

              <Text className="text-sm font-semibold text-muted-foreground pl-1">
                Display Name
              </Text>
              <Input
                className="border border-gray-300 rounded px-3 py-2 mb-4"
                placeholder="Display Name"
                value={editedProfile.displayName}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, displayName: text })
                }
              />
              <Text className="text-sm font-semibold text-muted-foreground pl-1">
                Description
              </Text>
              <Textarea
                className="border border-gray-300 rounded px-3 py-2 mb-4"
                placeholder="Description"
                multiline
                value={editedProfile.description}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, description: text })
                }
              />
              <View className="flex-row justify-between">
                <Button variant="outline" onPress={onClose}>
                  <Text>Cancel</Text>
                </Button>
                <Button onPress={handleSave}>
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
