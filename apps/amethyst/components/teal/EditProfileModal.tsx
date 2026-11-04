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
import { useQuery } from "@tanstack/react-query";
import { Cover } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { getProfileImageUrl } from "@/lib/teal/actors";
import { getUserTopReleases, type StatsPeriod } from "@/lib/teal/api";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import { ImagePlus, Save, UserRoundPen, X } from "lucide-react-native";

import type { ProfileView } from "@teal/lexicons/src/fm/teal/actor/defs";
import { $parse as parseProfileRecord, type Main as ProfileRecord } from "@teal/lexicons/src/fm/teal/actor/profile";

type EditableProfile = Pick<
  ProfileView,
  | "displayName"
  | "description"
  | "descriptionFacets"
  | "avatar"
  | "banner"
  | "statsDefaultPeriod"
  | "favorites"
>;

type FavouriteItem = { mbid: string; type: string };
const MAX_FAVOURITES = 4;

type EditProfileModalProps = {
  did: string;
  profile: EditableProfile | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (profile: EditableProfile) => void;
};

type BlobRef = NonNullable<ProfileRecord["avatar"]>;

const STATS_PERIOD_OPTIONS: Array<{ label: string; value: StatsPeriod }> = [
  { label: "7 days", value: "7days" },
  { label: "30 days", value: "30days" },
  { label: "90 days", value: "90days" },
  { label: "180 days", value: "180days" },
  { label: "365 days", value: "365days" },
  { label: "All time", value: "all" },
];

function normalizeStatsPeriod(value?: string): StatsPeriod {
  return STATS_PERIOD_OPTIONS.some((item) => item.value === value)
    ? (value as StatsPeriod)
    : "90days";
}

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
  const [statsDefaultPeriod, setStatsDefaultPeriod] =
    useState<StatsPeriod>("90days");
  const [favourites, setFavourites] = useState<FavouriteItem[]>([]);
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
    setStatsDefaultPeriod(normalizeStatsPeriod(profile?.statsDefaultPeriod));
    setFavourites((profile?.favorites as FavouriteItem[] | undefined) ?? []);
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
          collection: "fm.teal.actor.profile",
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
      const record: ProfileRecord = parseProfileRecord({
        ...currentRecord,
        $type: "fm.teal.actor.profile",
        displayName: displayName.trim(),
        description: description.trim(),
        descriptionFacets: richText.facets,
        avatar,
        banner,
        statsDefaultPeriod,
        favorites: favourites.length ? favourites : undefined,
      });

      if (swapRecord) {
        await agent.call(
          "com.atproto.repo.putRecord",
          {},
          {
            repo: agent.did,
            collection: "fm.teal.actor.profile",
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
            collection: "fm.teal.actor.profile",
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
        statsDefaultPeriod: record.statsDefaultPeriod,
        favorites: record.favorites,
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
              <Text className="text-xs text-primary font-medium">
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
                        className="text-ink-2"
                      />
                      <Text className="text-sm text-ink-2">
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
                <Text className="text-xs text-ink-2 font-medium">
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
                <Text className="text-xs text-ink-2 font-medium">
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
              <View className="gap-2">
                <Text className="text-xs text-ink-2 font-medium">
                  Default stats range
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {STATS_PERIOD_OPTIONS.map((item) => (
                    <Button
                      key={item.value}
                      size="sm"
                      variant={
                        statsDefaultPeriod === item.value
                          ? "default"
                          : "outline"
                      }
                      onPress={() => setStatsDefaultPeriod(item.value)}
                    >
                      <Text>{item.label}</Text>
                    </Button>
                  ))}
                </View>
              </View>
              <FavouritesEditor
                did={did}
                visible={visible}
                favourites={favourites}
                onChange={setFavourites}
              />
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

function mbidOf(item: FavouriteItem) {
  return item.mbid.replace(/^mbid:/, "");
}

/** Pick up to four favourite albums from your own most-played releases. */
function FavouritesEditor({
  did,
  visible,
  favourites,
  onChange,
}: {
  did: string;
  visible: boolean;
  favourites: FavouriteItem[];
  onChange: (next: FavouriteItem[]) => void;
}) {
  const top = useQuery({
    queryKey: ["top-releases", did, "all"],
    queryFn: () => getUserTopReleases(did, "all", 24),
    enabled: visible,
    staleTime: 10 * 60_000,
  });
  const chosen = new Set(favourites.map(mbidOf));
  const toggle = (mbid: string) => {
    if (chosen.has(mbid)) {
      onChange(favourites.filter((f) => mbidOf(f) !== mbid));
    } else if (favourites.length < MAX_FAVOURITES) {
      onChange([...favourites, { mbid: `mbid:${mbid}`, type: "release" }]);
    }
  };
  const releases = (top.data?.releases ?? []).filter((r) => r.mbid);

  return (
    <View className="gap-2">
      <Text className="text-xs text-ink-2 font-medium">
        Favourites ({favourites.length}/{MAX_FAVOURITES})
      </Text>
      <Text className="text-sm text-ink-2">
        Choose up to four albums from what you play most. Tap again to remove.
      </Text>
      {top.isLoading ? (
        <ActivityIndicator />
      ) : releases.length === 0 ? (
        <Text className="text-sm text-ink-2">
          Once you have listening history, your top albums appear here to choose from.
        </Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {releases.map((release) => {
            const mbid = release.mbid!.replace(/^mbid:/, "");
            const order = favourites.findIndex((f) => mbidOf(f) === mbid);
            const full = order < 0 && favourites.length >= MAX_FAVOURITES;
            return (
              <Pressable
                key={mbid}
                onPress={() => toggle(mbid)}
                disabled={full}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: order >= 0, disabled: full }}
                accessibilityLabel={release.name}
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
