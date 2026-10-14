import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { musicHref } from "@/components/teal/PlayFeedCard";
import {
  AddCurrentTrackButton,
  PlaylistTrackPicker,
} from "@/components/teal/PlaylistControls";
import RichText from "@/components/teal/RichText";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  displayArtists,
  getPlaylist,
  getProfile,
  type SocialPlaylistItemView,
  type SocialPlaylistView,
} from "@/lib/teal/api";
import {
  createPlaylistRouteScope,
  MAX_PLAYLIST_COLLABORATORS,
  resolvePlaylistAuthors,
} from "@/lib/teal/playlistEditing";
import { playlistHrefFromUri } from "@/lib/teal/routes";
import { trackViewToPlayView } from "@/lib/teal/social";
import { useStore } from "@/stores/mainStore";
import { RichText as AtprotoRichText } from "@atproto/api";
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
  const [authorsText, setAuthorsText] = useState("");
  const [coverUri, setCoverUri] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [retry, setRetry] = useState(0);
  const [coverChanged, setCoverChanged] = useState(false);
  const pdsAgent = useStore((state) => state.pdsAgent);
  const validUri = Boolean(playlistHrefFromUri(uri));
  const routeScope = useRef(createPlaylistRouteScope());
  // Invalidate immediately when the URL changes, before a late completion can
  // reach this render's effect. Returning to the same URI is a new generation.
  routeScope.current.setUri(uri);
  const isCurrentRoute = routeScope.current.capture(uri);
  useEffect(() => () => routeScope.current.invalidate(), []);

  useEffect(() => {
    let mounted = true;
    setPlaylist(null);
    setItems([]);
    setEditing(false);
    setError(null);
    setSaving(false);
    setAddingItem(false);
    if (!uri || !validUri) return;
    const timeout = setTimeout(() => {
      if (!mounted) return;
      mounted = false;
      setError("This playlist is taking too long to load. Try again.");
    }, 20_000);
    getPlaylist(uri)
      .then((res) => {
        if (!mounted) return;
        setPlaylist(res.playlist);
        setName(res.playlist.name);
        setDescription(res.playlist.description || "");
        setAuthorsText(
          res.playlist.authors
            .filter((did) => did !== res.playlist.authorDid)
            .join("\n"),
        );
        setCoverChanged(false);
        setCoverUri(
          res.playlist.coverCid
            ? getImageCdnLink({
                did: res.playlist.authorDid,
                hash: res.playlist.coverCid,
              })
            : undefined,
        );
        setItems(res.items);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [uri, validUri, retry]);

  useEffect(() => {
    let mounted = true;
    setCurrentTrack(null);
    if (!pdsAgent?.did) {
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

  const canAddItems = Boolean(
    pdsAgent?.did && playlist?.authors.includes(pdsAgent.did),
  );
  const canManage = Boolean(
    pdsAgent?.did && playlist?.authorDid === pdsAgent.did,
  );

  function appendItem(item: SocialPlaylistItemView) {
    if (!isCurrentRoute()) return;
    setItems((current) => (isCurrentRoute() ? [...current, item] : current));
    setPlaylist((current) =>
      current && current.uri === uri && isCurrentRoute()
        ? { ...current, itemCount: current.itemCount + 1 }
        : current,
    );
  }

  async function saveMetadata() {
    if (
      !playlist ||
      !pdsAgent?.did ||
      saving ||
      playlist.uri !== uri ||
      !isCurrentRoute()
    )
      return;
    const isCurrentOperation = routeScope.current.capture(playlist.uri);
    if (!name.trim()) {
      setError("Give your playlist a name before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const authors = await resolvePlaylistAuthors(
        authorsText,
        playlist.authorDid,
        async (handle) => {
          const response = await pdsAgent.resolveHandle({ handle });
          return response.data.did;
        },
      );
      const current: { cover?: unknown } = await pdsAgent
        .call("com.atproto.repo.getRecord", {
          repo: playlist.authorDid,
          collection: "fm.teal.feed.social.playlist",
          rkey: rkeyFromUri(playlist.uri),
        })
        .then((res) => res.data.value as { cover?: unknown });
      let cover = current.cover;
      if (coverUri && coverChanged) {
        const data = await fetch(coverUri).then((response) => response.blob());
        const fileType = data.type || "image/jpeg";
        cover = (await pdsAgent.uploadBlob(data, { encoding: fileType })).data
          .blob;
      }
      let descriptionFacets: unknown[] | undefined;
      if (description.trim()) {
        const rt = new AtprotoRichText({ text: description.trim() });
        await rt.detectFacets(pdsAgent);
        descriptionFacets = rt.facets;
      }
      await pdsAgent.call(
        "com.atproto.repo.putRecord",
        {},
        {
          repo: playlist.authorDid,
          collection: "fm.teal.feed.social.playlist",
          rkey: rkeyFromUri(playlist.uri),
          record: {
            $type: "fm.teal.feed.social.playlist",
            name: name.trim(),
            description: description.trim() || undefined,
            descriptionFacets,
            authors,
            cover,
            createdAt: playlist.createdAt,
          },
        },
      );
      if (!isCurrentOperation()) return;
      setPlaylist({
        ...playlist,
        name: name.trim(),
        description: description.trim() || undefined,
        descriptionFacets,
        authors,
      });
      setCoverChanged(false);
      setEditing(false);
    } catch (e) {
      if (isCurrentOperation())
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (isCurrentOperation()) setSaving(false);
    }
  }

  async function pickCover() {
    const isCurrentOperation = routeScope.current.capture(uri);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (isCurrentOperation() && !result.canceled) {
      setCoverUri(result.assets[0].uri);
      setCoverChanged(true);
    }
  }

  return (
    <TealShell>
      <Stack.Screen
        options={{ title: playlist?.name || "Playlist", headerShown: false }}
      />
      {!validUri && (
        <View className="gap-3 rounded-xl border border-border bg-card p-5">
          <Text className="text-2xl font-black">
            This playlist link is incomplete
          </Text>
          <Text className="text-muted-foreground">
            Ask for the full playlist link, or open a playlist from its owner's
            profile.
          </Text>
          <Link href="/" asChild>
            <Button className="self-start">
              <Text>Go home</Text>
            </Button>
          </Link>
        </View>
      )}
      {error && validUri && (
        <View className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">{error}</Text>
          {!playlist && (
            <Button
              variant="outline"
              className="mt-3 self-start"
              onPress={() => setRetry((value) => value + 1)}
            >
              <Text>Try again</Text>
            </Button>
          )}
        </View>
      )}
      {validUri && !playlist && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {playlist && (
        <>
          <View className="mb-8 rounded-lg border border-border bg-card p-6">
            <View className="flex-row items-start gap-4">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change playlist cover"
                disabled={!canManage || !editing}
                onPress={pickCover}
                className="h-14 w-14 overflow-hidden rounded-lg bg-accent"
              >
                {coverUri ? (
                  <Image source={{ uri: coverUri }} className="h-full w-full" />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Icon icon={ListMusic} size={24} className="text-primary" />
                  </View>
                )}
              </Pressable>
              <View className="min-w-0 flex-1">
                {editing ? (
                  <View className="gap-3">
                    <Text className="text-sm font-semibold">Playlist name</Text>
                    <Input
                      accessibilityLabel="Playlist name"
                      value={name}
                      onChangeText={setName}
                      maxLength={50}
                    />
                    <Text className="text-sm font-semibold">Description</Text>
                    <Textarea
                      accessibilityLabel="Playlist description"
                      className="min-h-20"
                      value={description}
                      onChangeText={setDescription}
                      maxLength={5000}
                    />
                    <Text className="text-sm font-semibold">Collaborators</Text>
                    <Text className="text-sm text-muted-foreground">
                      You own this playlist. Collaborators can add tracks. Enter
                      up to {MAX_PLAYLIST_COLLABORATORS} handles, one per line;
                      existing DIDs also work.
                    </Text>
                    <Textarea
                      accessibilityLabel="Collaborator handles"
                      className="min-h-20"
                      value={authorsText}
                      onChangeText={setAuthorsText}
                      placeholder="e.g. listener.bsky.social"
                    />
                    <View className="flex-row gap-2">
                      <Button
                        disabled={saving || !name.trim()}
                        onPress={saveMetadata}
                      >
                        <Text>{saving ? "Saving..." : "Save"}</Text>
                      </Button>
                      <Button
                        disabled={saving}
                        variant="ghost"
                        onPress={() => {
                          setName(playlist.name);
                          setDescription(playlist.description || "");
                          setAuthorsText(
                            playlist.authors
                              .filter((did) => did !== playlist.authorDid)
                              .join("\n"),
                          );
                          setCoverUri(
                            playlist.coverCid
                              ? getImageCdnLink({
                                  did: playlist.authorDid,
                                  hash: playlist.coverCid,
                                })
                              : undefined,
                          );
                          setCoverChanged(false);
                          setError(null);
                          setEditing(false);
                        }}
                      >
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
                      {items.length} tracks · {playlist.authors.length}{" "}
                      contributor
                      {playlist.authors.length === 1 ? "" : "s"}
                    </Text>
                  </>
                )}
              </View>
            </View>
            {canAddItems && !editing && (
              <View className="mt-5 flex-row flex-wrap gap-2">
                {canManage && (
                  <Button variant="outline" onPress={() => setEditing(true)}>
                    <Text>Edit playlist</Text>
                  </Button>
                )}
                <AddCurrentTrackButton
                  playlist={playlist}
                  track={currentTrack}
                  order={playlist.itemCount}
                  onAdded={appendItem}
                  disabled={addingItem}
                  onBusyChange={(busy) => {
                    if (isCurrentRoute()) setAddingItem(busy);
                  }}
                />
                {!currentTrack && (
                  <Text className="w-full text-sm text-muted-foreground">
                    No current track to add. Search for one below.
                  </Text>
                )}
              </View>
            )}
            {canAddItems && !editing && (
              <PlaylistTrackPicker
                playlist={playlist}
                items={items}
                order={playlist.itemCount}
                onAdded={appendItem}
                disabled={addingItem}
                onBusyChange={(busy) => {
                  if (isCurrentRoute()) setAddingItem(busy);
                }}
              />
            )}
          </View>

          <SectionHeading eyebrow="Playlist" title="Tracks" />
          {items.length === 0 ? (
            <Text className="text-muted-foreground">
              This playlist is empty. Add the first track to get it started.
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
                          <Icon
                            icon={Music2}
                            size={18}
                            className="text-primary"
                          />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="font-black" numberOfLines={1}>
                            {play.trackName}
                          </Text>
                          <Text
                            className="text-sm text-muted-foreground"
                            numberOfLines={1}
                          >
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
