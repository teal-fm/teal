import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, UserRoundPen, X } from "lucide-react-native";
import { MAX_FAVOURITES, ProfileImageError, saveProfileRecord, type FavouriteItem } from "@/lib/atp/profileRecord";
import { getProfileImageUrl } from "@/lib/teal/actors";
import { getUserTopReleases, type StatsPeriod } from "@/lib/teal/api";
import { normalizePeriod, STATS_PERIODS } from "@/lib/teal/topStats";
import { Button, Choices, Cover, Field, Heading, Icon, IconButton, Text } from "@/components/ds";
import type { DisplayProfile } from "@/hooks/useProfile";
import { profileKeys } from "@/hooks/useProfile";
import { useStore } from "@/stores/mainStore";

const plain = (mbid: string) => mbid.replace(/^mbid:/, "");

/** Pick up to four favourite albums from your most-played releases. */
function FavouritesPicker({ did, value, onChange }: { did: string; value: FavouriteItem[]; onChange: (next: FavouriteItem[]) => void }) {
  const top = useQuery({
    queryKey: ["top-releases", did, "all"],
    queryFn: () => getUserTopReleases(did, "all", 24),
    staleTime: 10 * 60_000,
  });
  const releases = (top.data?.releases ?? []).filter((r) => r.mbid);
  const toggle = (mbid: string) => {
    const index = value.findIndex((f) => plain(f.mbid) === mbid);
    if (index >= 0) onChange(value.filter((_, i) => i !== index));
    else if (value.length < MAX_FAVOURITES) onChange([...value, { mbid: `mbid:${mbid}`, type: "release" }]);
  };
  return (
    <View className="gap-2">
      <Text className="text-[14px] font-semibold">
        Favourites ({value.length}/{MAX_FAVOURITES})
      </Text>
      <Text className="text-[14px] text-ink-2">Choose up to four albums from what you play most. Tap again to remove.</Text>
      {top.isLoading ? (
        <ActivityIndicator />
      ) : releases.length === 0 ? (
        <Text className="text-[14px] text-ink-2">Once you have listening history, your top albums appear here.</Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {releases.map((release) => {
            const mbid = plain(release.mbid!);
            const order = value.findIndex((f) => plain(f.mbid) === mbid);
            const full = order < 0 && value.length >= MAX_FAVOURITES;
            return (
              <Pressable
                key={mbid}
                role="checkbox"
                aria-checked={order >= 0}
                aria-disabled={full}
                disabled={full}
                accessibilityLabel={release.name}
                onPress={() => toggle(mbid)}
                className={full ? "opacity-40" : undefined}
              >
                <Cover releaseMbId={mbid} size={64} radius={8} className={order >= 0 ? "border-2 border-tint" : undefined} />
                {order >= 0 ? (
                  <View className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full bg-tint">
                    <Text className="text-[11px] font-bold text-on-tint">{order + 1}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Edit your teal profile: images, name, bio, the default stats period, and favourites. */
export function EditProfileSheet({
  did,
  profile,
  visible,
  onClose,
}: {
  did: string;
  profile?: DisplayProfile;
  visible: boolean;
  onClose: () => void;
}) {
  const agent = useStore((state) => state.pdsAgent);
  const client = useQueryClient();
  const avatarUrl = getProfileImageUrl(did, profile?.avatar, "avatar");
  const bannerUrl = getProfileImageUrl(did, profile?.banner, "banner");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState<StatsPeriod>("90days");
  const [favourites, setFavourites] = useState<FavouriteItem[]>([]);
  const [avatarUri, setAvatarUri] = useState("");
  const [bannerUri, setBannerUri] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDisplayName(profile?.displayName || "");
    setDescription(profile?.description || "");
    setPeriod(normalizePeriod(profile?.statsDefaultPeriod));
    setFavourites((profile?.favorites as FavouriteItem[] | undefined) ?? []);
    setAvatarUri(avatarUrl || "");
    setBannerUri(bannerUrl || "");
    setError(null);
  }, [visible, profile, avatarUrl, bannerUrl]);

  const pick = async (kind: "avatar" | "banner") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: kind === "avatar" ? [1, 1] : [3, 1],
      quality: 0.92,
    });
    if (result.canceled) return;
    if (kind === "avatar") setAvatarUri(result.assets[0].uri);
    else setBannerUri(result.assets[0].uri);
  };

  const save = async () => {
    if (!agent || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfileRecord(
        agent,
        { displayName, description, statsDefaultPeriod: period, favourites, avatarUri, bannerUri },
        { avatarUrl, bannerUrl },
      );
      await client.invalidateQueries({ queryKey: profileKeys.profile(did) });
      onClose();
    } catch (e) {
      setError(e instanceof ProfileImageError ? e.message : "Your profile didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-4 py-8">
        <View role="dialog" aria-modal aria-label="Edit profile" className="max-h-full w-full max-w-xl overflow-hidden rounded-[26px] border border-glass-edge bg-ground">
          <View className="flex-row items-center justify-between border-b border-hair px-5 py-4">
            <Heading level={1} size="title">
              Edit profile
            </Heading>
            <IconButton icon={X} label="Close" size={36} onPress={onClose} />
          </View>
          <ScrollView contentContainerClassName="gap-5 p-5" keyboardShouldPersistTaps="handled">
            <Pressable accessibilityRole="button" accessibilityLabel="Change banner image" onPress={() => pick("banner")}>
              <View className="aspect-[3/1] w-full items-center justify-center overflow-hidden rounded-[16px] bg-fill">
                {bannerUri ? (
                  <Image source={{ uri: bannerUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <View className="items-center gap-1">
                    <Icon icon={ImagePlus} size={24} className="text-ink-2" />
                    <Text className="text-[14px] text-ink-2">Add a banner</Text>
                  </View>
                )}
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
              onPress={() => pick("avatar")}
              className="-mt-14 ml-4 self-start"
            >
              <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-ground bg-tint">
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <Icon icon={UserRoundPen} size={28} className="text-on-tint" />
                )}
              </View>
            </Pressable>
            <Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={64} />
            <Field label="Bio" value={description} onChangeText={setDescription} multiline maxLength={256} hint={`${description.length}/256`} />
            <View className="gap-2">
              <Text className="text-[14px] font-semibold">Stats period shown first</Text>
              <Choices label="Stats period shown first" value={period} onChange={setPeriod} options={STATS_PERIODS} />
            </View>
            <FavouritesPicker did={did} value={favourites} onChange={setFavourites} />
            {error ? (
              <Text role="alert" className="text-[14px] text-destructive">
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <View className="flex-row justify-end gap-2.5 border-t border-hair px-5 py-4">
            <Button label="Cancel" variant="secondary" onPress={onClose} />
            <Button label={saving ? "Saving" : "Save"} loading={saving} onPress={save} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
