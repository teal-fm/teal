import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { RichText as AtprotoRichText } from "@atproto/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { getProfileImageUrl } from "@/lib/teal/actors";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import { ImagePlus, Save, UserRoundPen, X } from "lucide-react-native";

import type { ProfileView } from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import type { Record as ProfileRecord } from "@teal/lexicons/src/types/fm/teal/alpha/actor/profile";

type EditableProfile = Pick<
  ProfileView,
  "displayName" | "description" | "descriptionFacets" | "avatar" | "banner"
>;

type EditProfileModalProps = {
  did: string;
  profile: EditableProfile | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (profile: EditableProfile) => void;
};

type BlobRef = NonNullable<ProfileRecord["avatar"]>;

function blobCid(blob?: BlobRef) {
  if (!blob) return undefined;
  const value = blob as unknown as {
    ref?: { $link?: string };
    ["r#ref"]?: string;
    cid?: string;
  };
  return value.ref?.$link || value["r#ref"] || value.cid;
}

function mimeFromUri(uri: string, fallback = "image/jpeg") {
  if (uri.startsWith("data:")) return uri.slice(5, uri.indexOf(";")) || fallback;
  if (uri.endsWith(".png")) return "image/png";
  if (uri.endsWith(".webp")) return "image/webp";
  return fallback;
}

async function selectedImageBlob(uri: string) {
  const response = await fetch(uri);
  const data = await response.blob();
  return new Blob([data], { type: data.type || mimeFromUri(uri) });
}

async function maybeUploadImage(
  agent: NonNullable<ReturnType<typeof useStore.getState>["pdsAgent"]>,
  uri: string,
  currentBlob: BlobRef | undefined,
  currentUrl: string | undefined,
) {
  if (!uri) return undefined;
  if (currentBlob && uri === currentUrl) return currentBlob;
  const blob = await selectedImageBlob(uri);
  return (
    await agent.uploadBlob(blob, { encoding: blob.type || mimeFromUri(uri) })
  ).data.blob as unknown as BlobRef;
}

export default function EditProfileModal({
  did,
  profile,
  visible,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUri, setAvatarUri] = useState("");
  const [bannerUri, setBannerUri] = useState("");
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<"avatar" | "banner" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const agent = useStore((state) => state.pdsAgent);

  const currentAvatarUrl = useMemo(
    () => getProfileImageUrl(did, profile?.avatar, "avatar"),
    [did, profile?.avatar],
  );
  const currentBannerUrl = useMemo(
    () => getProfileImageUrl(did, profile?.banner, "banner"),
    [did, profile?.banner],
  );

  useEffect(() => {
    if (!visible) return;
    setDisplayName(profile?.displayName || "");
    setDescription(profile?.description || "");
    setAvatarUri(currentAvatarUrl || "");
    setBannerUri(currentBannerUrl || "");
    setError(null);
  }, [currentAvatarUrl, currentBannerUrl, profile, visible]);

  async function pickImage(kind: "avatar" | "banner") {
    setPicking(kind);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: kind === "avatar" ? [1, 1] : [3, 1],
        quality: 0.92,
      });
      if (!result.canceled) {
        if (kind === "avatar") setAvatarUri(result.assets[0].uri);
        else setBannerUri(result.assets[0].uri);
      }
    } finally {
      setPicking(null);
    }
  }

  async function save() {
    if (!agent?.did || saving) return;
    setSaving(true);
    setError(null);
    try {
      let currentRecord: ProfileRecord | undefined;
      let swapRecord: string | undefined;
      try {
        const existing = await agent.call("com.atproto.repo.getRecord", {
          repo: agent.did,
          collection: "fm.teal.alpha.actor.profile",
          rkey: "self",
        });
        currentRecord = existing.data.value as ProfileRecord;
        swapRecord = existing.data.cid;
      } catch {
        currentRecord = undefined;
      }

      const richText = new AtprotoRichText({ text: description.trim() });
      await richText.detectFacets(agent);
      const avatar = await maybeUploadImage(
        agent,
        avatarUri,
        currentRecord?.avatar,
        currentAvatarUrl,
      );
      const banner = await maybeUploadImage(
        agent,
        bannerUri,
        currentRecord?.banner,
        currentBannerUrl,
      );
      const record: ProfileRecord = {
        displayName: displayName.trim(),
        description: description.trim(),
        descriptionFacets: richText.facets,
        avatar,
        banner,
      };

      if (swapRecord) {
        await agent.call(
          "com.atproto.repo.putRecord",
          {},
          {
            repo: agent.did,
            collection: "fm.teal.alpha.actor.profile",
            rkey: "self",
            record,
            swapRecord,
          },
        );
      } else {
        await agent.call(
          "com.atproto.repo.createRecord",
          {},
          {
            repo: agent.did,
            collection: "fm.teal.alpha.actor.profile",
            rkey: "self",
            record,
          },
        );
      }

      onSaved({
        displayName: record.displayName,
        description: record.description,
        descriptionFacets: record.descriptionFacets,
        avatar: blobCid(avatar) || profile?.avatar,
        banner: blobCid(banner) || profile?.banner,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/55 px-4 py-8">
        <View className="max-h-full w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-background">
          <View className="flex-row items-start justify-between border-b border-border p-4">
            <View>
              <Text className="font-mono text-[10px] uppercase text-primary">
                Teal profile
              </Text>
              <Text className="font-sans text-2xl font-black">Edit profile</Text>
            </View>
            <Button variant="ghost" size="icon" onPress={onClose}>
              <Icon icon={X} size={20} />
            </Button>
          </View>
          <ScrollView className="max-h-[80vh]">
            <View className="gap-5 p-4">
              <Pressable onPress={() => pickImage("banner")}>
                <View className="aspect-[3/1] w-full overflow-hidden rounded-lg border border-border bg-muted">
                  {bannerUri ? (
                    <Image
                      source={{ uri: bannerUri }}
                      className="h-full w-full"
                    />
                  ) : (
                    <View className="h-full w-full items-center justify-center gap-2">
                      <Icon
                        icon={ImagePlus}
                        size={24}
                        className="text-muted-foreground"
                      />
                      <Text className="text-sm text-muted-foreground">
                        Add banner image
                      </Text>
                    </View>
                  )}
                  {picking === "banner" && (
                    <View className="absolute inset-0 items-center justify-center bg-background/70">
                      <ActivityIndicator />
                    </View>
                  )}
                </View>
              </Pressable>
              <Pressable
                onPress={() => pickImage("avatar")}
                className="-mt-12 self-start pl-4"
              >
                <View className="h-24 w-24 overflow-hidden rounded-lg border-4 border-background bg-primary">
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      className="h-full w-full"
                    />
                  ) : (
                    <View className="h-full w-full items-center justify-center">
                      <Icon
                        icon={UserRoundPen}
                        size={28}
                        className="text-primary-foreground"
                      />
                    </View>
                  )}
                  {picking === "avatar" && (
                    <View className="absolute inset-0 items-center justify-center bg-background/70">
                      <ActivityIndicator />
                    </View>
                  )}
                </View>
              </Pressable>
              <View className="gap-2">
                <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                  Display name
                </Text>
                <Input
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="How should Teal show your name?"
                  maxLength={64}
                />
              </View>
              <View className="gap-2">
                <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                  Bio
                </Text>
                <Textarea
                  value={description}
                  onChangeText={setDescription}
                  placeholder="A few words, links, or mentions."
                  numberOfLines={5}
                  maxLength={512}
                />
              </View>
              {error && (
                <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <Text className="font-bold text-destructive">{error}</Text>
                </View>
              )}
              <View className="flex-row justify-end gap-2">
                <Button variant="outline" onPress={onClose} disabled={saving}>
                  <Text>Cancel</Text>
                </Button>
                <Button
                  className="flex-row gap-2"
                  onPress={save}
                  disabled={saving || !agent}
                >
                  {saving ? (
                    <ActivityIndicator />
                  ) : (
                    <Icon icon={Save} size={17} />
                  )}
                  <Text>{saving ? "Saving" : "Save profile"}</Text>
                </Button>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
