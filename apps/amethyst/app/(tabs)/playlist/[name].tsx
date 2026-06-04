import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { AddCurrentTrackButton } from "@/components/teal/PlaylistControls";
import RichText from "@/components/teal/RichText";
import RightRail from "@/components/teal/RightRail";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  displayArtists,
  getPlaylist,
  getProfile,
  type SocialPlaylistItemView,
  type SocialPlaylistView,
} from "@/lib/teal/api";
import { musicHref } from "@/components/teal/PlayFeedCard";
import { trackViewToPlayView } from "@/lib/teal/social";
import { useStore } from "@/stores/mainStore";
import { ListMusic, Music2 } from "lucide-react-native";

function rkeyFromUri(uri: string) {
  return uri.split("/").pop() || "";
}

export default function PlaylistDetailScreen() {
  const params = useLocalSearchParams();
  const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri;
  const [playlist, setPlaylist] = useState<SocialPlaylistView | null>(null);
  const [items, setItems] = useState<SocialPlaylistItemView[]>([]);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pdsAgent = useStore((state) => state.pdsAgent);

  useEffect(() => {
    let mounted = true;
    if (!uri) return;
    getPlaylist(uri)
      .then((res) => {
        if (!mounted) return;
        setPlaylist(res.playlist);
        setName(res.playlist.name);
        setDescription(res.playlist.description || "");
        setItems(res.items);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      mounted = false;
    };
  }, [uri]);

  useEffect(() => {
    let mounted = true;
    if (!pdsAgent?.did) {
      setCurrentTrack(null);
      return;
    }
    getProfile(pdsAgent.did)
      .then((res) => {
        if (mounted) setCurrentTrack(res.profile.status?.item || null);
      })
      .catch(() => {
        if (mounted) setCurrentTrack(null);
      });
    return () => {
      mounted = false;
    };
  }, [pdsAgent?.did]);

  const canEdit = useMemo(
    () => Boolean(pdsAgent?.did && playlist?.authors.includes(pdsAgent.did)),
    [pdsAgent?.did, playlist?.authors],
  );

  async function saveMetadata() {
    if (!playlist || !pdsAgent?.did || saving) return;
    setSaving(true);
    try {
      await pdsAgent.call(
        "com.atproto.repo.putRecord",
        {},
        {
          repo: playlist.authorDid,
          collection: "fm.teal.alpha.feed.social.playlist",
          rkey: rkeyFromUri(playlist.uri),
          record: {
            $type: "fm.teal.alpha.feed.social.playlist",
            name: name.trim(),
            description: description.trim() || undefined,
            authors: playlist.authors,
            createdAt: playlist.createdAt,
          },
        },
      );
      setPlaylist({
        ...playlist,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen
        options={{ title: playlist?.name || "Playlist", headerShown: false }}
      />
      {error && (
        <View className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">{error}</Text>
        </View>
      )}
      {!playlist && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {playlist && (
        <>
          <View className="mb-8 rounded-lg border border-border bg-card p-6">
            <View className="flex-row items-start gap-4">
              <View className="h-14 w-14 items-center justify-center rounded-lg bg-accent">
                <Icon icon={ListMusic} size={24} className="text-primary" />
              </View>
              <View className="min-w-0 flex-1">
                {editing ? (
                  <View className="gap-3">
                    <Input value={name} onChangeText={setName} />
                    <Textarea
                      className="min-h-20"
                      value={description}
                      onChangeText={setDescription}
                    />
                    <View className="flex-row gap-2">
                      <Button disabled={saving} onPress={saveMetadata}>
                        <Text>{saving ? "Saving..." : "Save"}</Text>
                      </Button>
                      <Button variant="ghost" onPress={() => setEditing(false)}>
                        <Text>Cancel</Text>
                      </Button>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text className="font-sans text-3xl font-black">
                      {playlist.name}
                    </Text>
                    {playlist.description && (
                      <RichText
                        className="mt-3 text-base"
                        text={playlist.description}
                        facets={playlist.descriptionFacets}
                      />
                    )}
                    <Text className="mt-2 font-mono text-[10px] uppercase text-muted-foreground">
                      {items.length} indexed tracks · {playlist.authors.length} author
                      {playlist.authors.length === 1 ? "" : "s"}
                    </Text>
                  </>
                )}
              </View>
            </View>
            {canEdit && !editing && (
              <View className="mt-5 flex-row flex-wrap gap-2">
                <Button variant="outline" onPress={() => setEditing(true)}>
                  <Text>Edit playlist</Text>
                </Button>
                <AddCurrentTrackButton
                  playlist={playlist}
                  track={currentTrack}
                  order={items.length}
                  onAdded={(item) => setItems((current) => [...current, item])}
                />
              </View>
            )}
          </View>

          <SectionHeading eyebrow="Playlist" title="Tracks" />
          {items.length === 0 ? (
            <Text className="text-muted-foreground">
              No indexed playlist items yet.
            </Text>
          ) : (
            <View className="gap-3">
              {items.map((item, index) => {
                const play = trackViewToPlayView(item.track);
                return (
                  <Link key={item.uri} href={musicHref(play) as any} asChild>
                    <Pressable className="rounded-lg border border-border bg-card p-4">
                      <View className="flex-row items-center gap-3">
                        <Text className="w-7 font-mono text-xs text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </Text>
                        <View className="h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Icon icon={Music2} size={18} className="text-primary" />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="font-black" numberOfLines={1}>
                            {play.trackName}
                          </Text>
                          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                            {displayArtists(play) || "Unknown artist"}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          )}
        </>
      )}
    </TealShell>
  );
}
