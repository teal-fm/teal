import { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import PlayFeedCard, { musicHref } from "@/components/teal/PlayFeedCard";
import RightRail from "@/components/teal/RightRail";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  displayArtists,
  getPlayByAuthorRkey,
  getRecordingCoverArtUrl,
} from "@/lib/teal/api";
import {
  actorProfileHref,
  displayActorName,
  getCachedBlueskyProfile,
  type DisplayActor,
} from "@/lib/teal/actors";
import {
  applyEditableFields,
  artistTextFromRecord,
  deletePlayRecord,
  loadPlayRecord,
  putPlayRecord,
  type EditablePlayRecord,
} from "@/lib/teal/playRecords";
import { timeAgo } from "@/lib/utils";
import { useStore } from "@/stores/mainStore";
import {
  Disc3,
  ExternalLink,
  Pencil,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/feed/defs";

export default function ListenDetail() {
  const params = useLocalSearchParams();
  const did = Array.isArray(params.did) ? params.did[0] : params.did;
  const rkey = Array.isArray(params.rkey) ? params.rkey[0] : params.rkey;
  const [play, setPlay] = useState<PlayView | null>(null);
  const [blueskyAuthor, setBlueskyAuthor] = useState<DisplayActor>();
  const [recordingArt, setRecordingArt] = useState<string>();
  const [artFailed, setArtFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sourceRecord, setSourceRecord] = useState<EditablePlayRecord | null>(
    null,
  );
  const [swapRecord, setSwapRecord] = useState<string>();
  const [trackName, setTrackName] = useState("");
  const [artistsText, setArtistsText] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [playedTime, setPlayedTime] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const agent = useStore((state) => state.pdsAgent);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!did || !rkey) return;
      try {
        setError(null);
        setDeleted(false);
        const response = await getPlayByAuthorRkey(did, rkey);
        if (mounted) setPlay(response.play);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [did, rkey]);

  const indexedAuthor = play?.author as DisplayActor | undefined;
  const authorProfile = indexedAuthor
    ? {
        ...blueskyAuthor,
        ...indexedAuthor,
        avatar: indexedAuthor.avatar || blueskyAuthor?.avatar,
        displayName: indexedAuthor.displayName || blueskyAuthor?.displayName,
        handle: indexedAuthor.handle || blueskyAuthor?.handle,
      }
    : blueskyAuthor;
  const authorDid = authorProfile?.did || play?.authorDid || did;
  const authorName = displayActorName(authorProfile, authorDid);
  const authorHref = actorProfileHref(authorProfile, authorDid);
  const releaseArt = coverArtUrl(play?.releaseMbId, 500);
  const art = artFailed ? undefined : releaseArt || recordingArt;
  const when = play?.playedTime
    ? timeAgo(new Date(play.playedTime))
    : play
      ? "recently"
      : "";
  const canManage = !!agent?.did && !!did && agent.did === did && !!rkey;

  async function openEditor() {
    if (!agent || !did || !rkey || !play) return;
    setEditBusy(true);
    setError(null);
    try {
      const loaded = await loadPlayRecord(agent, did, rkey, play);
      setSourceRecord(loaded.record);
      setSwapRecord(loaded.swapRecord);
      setTrackName(loaded.record.trackName);
      setArtistsText(artistTextFromRecord(loaded.record));
      setReleaseName(loaded.record.releaseName || "");
      setPlayedTime(
        loaded.record.playedTime
          ? loaded.record.playedTime.slice(0, 16)
          : "",
      );
      setDeleteArmed(false);
      setEditOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function saveEdit() {
    if (!agent || !did || !rkey || !sourceRecord) return;
    setEditBusy(true);
    setError(null);
    try {
      const record = applyEditableFields(sourceRecord, {
        trackName,
        artistsText,
        releaseName,
        playedTime,
      });
      await putPlayRecord(agent, did, rkey, record, swapRecord);
      setSourceRecord(record);
      setSwapRecord(undefined);
      setPlay((current) =>
        current
          ? {
              ...current,
              trackName: record.trackName,
              artists: record.artists || [],
              releaseName: record.releaseName,
              playedTime: record.playedTime,
            }
          : current,
      );
      setEditOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteListen() {
    if (!agent || !did || !rkey) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setEditBusy(true);
    setError(null);
    try {
      await deletePlayRecord(agent, did, rkey);
      setPlay(null);
      setDeleted(true);
      setEditOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEditBusy(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    const needsBlueskyFallback =
      !indexedAuthor?.displayName || !indexedAuthor?.handle;
    if (!authorDid || !needsBlueskyFallback) {
      setBlueskyAuthor(undefined);
      return;
    }
    getCachedBlueskyProfile(authorDid).then((profile) => {
      if (mounted) setBlueskyAuthor(profile);
    });
    return () => {
      mounted = false;
    };
  }, [authorDid, indexedAuthor]);

  useEffect(() => {
    let mounted = true;
    setArtFailed(false);
    if (releaseArt || !play?.recordingMbId) {
      setRecordingArt(undefined);
      return;
    }
    getRecordingCoverArtUrl(play.recordingMbId, 500).then((url) => {
      if (mounted) setRecordingArt(url);
    });
    return () => {
      mounted = false;
    };
  }, [play?.recordingMbId, releaseArt]);

  return (
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen
        options={{ title: play?.trackName || "Listen", headerShown: false }}
      />
      {!play && !error && !deleted && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {deleted && (
        <View className="rounded-lg border border-border bg-card p-6">
          <Text className="font-sans text-2xl font-black">
            Listen deleted.
          </Text>
          <Text className="mt-2 text-muted-foreground">
            Cadet will remove it from public feeds after the PDS update is
            indexed.
          </Text>
        </View>
      )}
      {error && (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load listen: {error}
          </Text>
        </View>
      )}
      {play && (
        <>
          <View className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
            <View className="h-44 bg-muted">
              {art ? (
                <Image
                  source={{ uri: art }}
                  className="h-full w-full opacity-35"
                  onError={() => setArtFailed(true)}
                />
              ) : null}
            </View>
            <View className="-mt-12 px-5 pb-6">
              <View className="flex-row items-end gap-4">
                {art ? (
                  <Image
                    source={{ uri: art }}
                    className="h-24 w-24 rounded-lg border-4 border-background bg-muted md:h-28 md:w-28"
                    onError={() => setArtFailed(true)}
                  />
                ) : (
                  <View className="h-24 w-24 items-center justify-center rounded-lg border-4 border-background bg-muted md:h-28 md:w-28">
                    <Icon
                      icon={Disc3}
                      size={42}
                      className="text-muted-foreground"
                    />
                  </View>
                )}
                <View className="min-w-0 flex-1 pb-2">
                  <Text className="font-mono text-xs uppercase text-primary">
                    Listen
                  </Text>
                  <Text
                    className="font-sans text-3xl font-black leading-tight"
                    numberOfLines={3}
                  >
                    {play.trackName}
                  </Text>
                  <Text
                    className="font-bold text-muted-foreground"
                    numberOfLines={1}
                  >
                    {displayArtists(play) || "Unknown artist"}
                  </Text>
                </View>
              </View>

              <View className="mt-5 flex-row flex-wrap gap-2">
                <Link href={`/profile/${authorHref}` as any} asChild>
                  <Button variant="outline" className="flex-row gap-2">
                    <Icon icon={UserRound} size={16} />
                    <Text>{authorName}</Text>
                  </Button>
                </Link>
                <Link href={musicHref(play) as any} asChild>
                  <Button variant="outline" className="flex-row gap-2">
                    <Icon icon={ExternalLink} size={16} />
                    <Text>Song page</Text>
                  </Button>
                </Link>
                {canManage && (
                  <Button
                    variant="outline"
                    className="flex-row gap-2"
                    disabled={editBusy}
                    onPress={openEditor}
                  >
                    <Icon icon={Pencil} size={16} />
                    <Text>Edit listen</Text>
                  </Button>
                )}
              </View>

              <Text className="mt-4 text-sm text-muted-foreground">
                {authorName} listened {when}
                {play.releaseName ? ` from ${play.releaseName}` : ""}.
              </Text>

              {editOpen && canManage && (
                <View className="mt-5 gap-3 rounded-lg border border-border bg-background p-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1">
                      <Text className="font-mono text-xs uppercase text-muted-foreground">
                        Edit record
                      </Text>
                      <Text className="font-bold">
                        Changes are written to your PDS and reindexed by Cadet.
                      </Text>
                    </View>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={editBusy}
                      onPress={() => setEditOpen(false)}
                    >
                      <Icon icon={X} size={18} />
                    </Button>
                  </View>
                  <View className="gap-2">
                    <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                      Track
                    </Text>
                    <Input
                      value={trackName}
                      onChangeText={setTrackName}
                      editable={!editBusy}
                    />
                  </View>
                  <View className="gap-2">
                    <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                      Artists
                    </Text>
                    <Input
                      value={artistsText}
                      onChangeText={setArtistsText}
                      editable={!editBusy}
                    />
                  </View>
                  <View className="gap-2">
                    <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                      Release
                    </Text>
                    <Input
                      value={releaseName}
                      onChangeText={setReleaseName}
                      editable={!editBusy}
                    />
                  </View>
                  <View className="gap-2">
                    <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                      Played time
                    </Text>
                    <Input
                      value={playedTime}
                      onChangeText={setPlayedTime}
                      editable={!editBusy}
                      inputMode="text"
                      placeholder="2026-06-15T12:30"
                    />
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      className="flex-row gap-2"
                      disabled={editBusy}
                      onPress={saveEdit}
                    >
                      <Icon icon={Save} size={16} />
                      <Text>Save listen</Text>
                    </Button>
                    <Button
                      variant={deleteArmed ? "destructive" : "outline"}
                      className="flex-row gap-2"
                      disabled={editBusy}
                      onPress={deleteListen}
                    >
                      <Icon icon={Trash2} size={16} />
                      <Text>{deleteArmed ? "Confirm delete" : "Delete"}</Text>
                    </Button>
                  </View>
                </View>
              )}
            </View>
          </View>

          <SectionHeading eyebrow="Activity" title="This listen" />
          <PlayFeedCard play={play} />
        </>
      )}
    </TealShell>
  );
}
