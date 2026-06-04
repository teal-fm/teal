import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import {
  getBadgeCatalog,
  type SocialBadgeAssignmentView,
  type SocialBadgeView,
} from "@/lib/teal/api";
import { useStore } from "@/stores/mainStore";

type BadgeManagerProps = {
  onAssigned: (assignment: SocialBadgeAssignmentView) => void;
};

export default function BadgeManager({ onAssigned }: BadgeManagerProps) {
  const pdsAgent = useStore((state) => state.pdsAgent);
  const [badges, setBadges] = useState<SocialBadgeView[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string>();
  const [assignee, setAssignee] = useState("");
  const [selectedBadge, setSelectedBadge] = useState<SocialBadgeView>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBadgeCatalog(50)
      .then((res) => setBadges(res.items))
      .catch(() => setBadges([]));
  }, []);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function createBadge() {
    if (!pdsAgent?.did || !name.trim() || !description.trim() || !imageUri) return;
    setBusy(true);
    setError(null);
    try {
      const data = await fetch(imageUri).then((response) => response.blob());
      const fileType = data.type || "image/png";
      const image = (await pdsAgent.uploadBlob(data, { encoding: fileType })).data
        .blob;
      const record = {
        $type: "fm.teal.alpha.feed.social.badge",
        name: name.trim(),
        description: description.trim(),
        image,
        creator: pdsAgent.did,
        type: "achievement",
        createdAt: new Date().toISOString(),
      };
      const res = await pdsAgent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: pdsAgent.did,
          collection: "fm.teal.alpha.feed.social.badge",
          record,
        },
      );
      const created: SocialBadgeView = {
        uri: (res.data as { uri?: string }).uri || "",
        cid: (res.data as { cid?: string }).cid || "",
        name: record.name,
        description: record.description,
        imageCid: (image as any)?.ref?.$link || (image as any)?.ref?.toString?.() || "",
        creator: record.creator,
        badgeType: record.type,
        createdAt: record.createdAt,
      };
      setBadges((current) => [created, ...current]);
      setSelectedBadge(created);
      setName("");
      setDescription("");
      setImageUri(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function assignBadge() {
    if (!pdsAgent?.did || !selectedBadge || !assignee.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const record = {
        $type: "fm.teal.alpha.feed.social.badgeAssignment",
        badge: { uri: selectedBadge.uri, cid: selectedBadge.cid },
        assignee: assignee.trim(),
        assigner: pdsAgent.did,
        createdAt: new Date().toISOString(),
      };
      const res = await pdsAgent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: pdsAgent.did,
          collection: "fm.teal.alpha.feed.social.badgeAssignment",
          record,
        },
      );
      onAssigned({
        uri: (res.data as { uri?: string }).uri || "",
        cid: (res.data as { cid?: string }).cid || "",
        badge: selectedBadge,
        assignee: record.assignee,
        assigner: record.assigner,
        createdAt: record.createdAt,
      });
      setAssignee("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!pdsAgent?.did) return null;

  return (
    <View className="gap-4 rounded-lg border border-border bg-card p-4">
      <View>
        <Text className="font-mono text-[10px] uppercase text-primary">
          Badge management
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Create badge definitions and assign them to Teal actors.
        </Text>
      </View>
      <View className="gap-3">
        <Input placeholder="Badge name" value={name} onChangeText={setName} />
        <Textarea
          className="min-h-20"
          placeholder="Badge description"
          value={description}
          onChangeText={setDescription}
        />
        <Pressable
          onPress={pickImage}
          className="h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} className="h-full w-full" />
          ) : (
            <Text className="text-center text-xs text-muted-foreground">
              Pick image
            </Text>
          )}
        </Pressable>
        <Button disabled={busy} className="self-start" onPress={createBadge}>
          <Text>{busy ? "Working..." : "Create badge"}</Text>
        </Button>
      </View>

      {badges.length > 0 && (
        <View className="gap-2">
          <Text className="font-mono text-[10px] uppercase text-muted-foreground">
            Assign badge
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {badges.map((badge) => (
              <Pressable
                key={badge.uri}
                onPress={() => setSelectedBadge(badge)}
                className={`rounded-full border px-3 py-1 ${
                  selectedBadge?.uri === badge.uri
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted"
                }`}
              >
                <Text className="text-xs font-bold">{badge.name}</Text>
              </Pressable>
            ))}
          </View>
          <Input
            placeholder="Assignee DID"
            value={assignee}
            onChangeText={setAssignee}
          />
          {selectedBadge?.imageCid && (
            <Image
              source={{
                uri: getImageCdnLink({
                  did: selectedBadge.creator,
                  hash: selectedBadge.imageCid,
                }),
              }}
              className="h-12 w-12 rounded-lg"
            />
          )}
          <Button disabled={busy || !selectedBadge} className="self-start" onPress={assignBadge}>
            <Text>Assign badge</Text>
          </Button>
        </View>
      )}
      {error && <Text className="text-sm text-destructive">{error}</Text>}
    </View>
  );
}
