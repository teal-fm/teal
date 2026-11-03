import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import LoadFailure from "@/components/teal/LoadFailure";
import PlayFeedCard, { musicHref } from "@/components/teal/PlayFeedCard";
import RightRail from "@/components/teal/RightRail";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  actorProfileHref,
  displayActorName,
  getCachedBlueskyProfile,
  type DisplayActor,
} from "@/lib/teal/actors";
import {
  coverArtUrl,
  displayArtists,
  getPlayByAuthorRkey,
  getRecordingCoverArtUrl,
  XrpcError,
} from "@/lib/teal/api";
import { readListenDetail } from "@/lib/teal/listenReadback";
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
  removePendingListens,
  retainConfirmedListens,
  retireIndexedListens,
  usePendingListens,
} from "@/stores/pendingListenStore";
import {
  Disc3,
  ExternalLink,
  Pencil,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type { Main as PlayRecord } from "@teal/lexicons/src/fm/teal/feed/play";

export default function ListenDetail() {
  const params = useLocalSearchParams();
  const did = Array.isArray(params.did) ? params.did[0] : params.did;
  const rkey = Array.isArray(params.rkey) ? params.rkey[0] : params.rkey;
  const agent = useStore((state) => state.pdsAgent);
  const authStatus = useStore((state) => state.status);
  const viewerDid = authStatus === "loggedIn" ? agent?.did : undefined;
  const uri = did && rkey ? `at://${did}/fm.teal.feed.play/${rkey}` : undefined;
  const routeIdentity = `${uri || ""}:${viewerDid || ""}`;
  const currentRoute = useRef(routeIdentity);
  currentRoute.current = routeIdentity;
  const requestVersion = useRef(0);
  const routeVersion = useRef(0);
  const deletedRoute = useRef<string | undefined>(undefined);
  const latestEdit = useRef<{ identity: string; play: PlayView } | undefined>(
    undefined,
  );
  const mutationLock = useRef(false);
  const pending = usePendingListens(viewerDid === did ? viewerDid : undefined);
  const ownPending = pending.find((entry) => entry.play.uri === uri);
  const currentConfirmed = useRef(ownPending?.play);
  currentConfirmed.current =
    ownPending?.play ||
    (latestEdit.current?.identity === routeIdentity
      ? latestEdit.current.play
      : undefined);
  const [view, setView] = useState<{
    identity: string;
    play: PlayView;
    syncing: boolean;
  }>();
  const play = view?.identity === routeIdentity ? view.play : null;
  const syncing = view?.identity === routeIdentity && view.syncing;
  const [retry, setRetry] = useState(0);
  const [blueskyAuthor, setBlueskyAuthor] = useState<DisplayActor>();
  const [recordingArt, setRecordingArt] = useState<string>();
  const [artFailed, setArtFailed] = useState(false);
  const [errorState, setErrorState] = useState<{
    identity: string;
    message: string;
    status?: number;
    kind?: "action";
  }>();
  const error =
    errorState?.identity === routeIdentity ? errorState.message : undefined;
  const setError = (message: string | null) =>
    setErrorState(
      message
        ? { identity: routeIdentity, message, kind: "action" }
        : undefined,
    );
  const [deletedIdentity, setDeletedIdentity] = useState<string>();
  const deleted = deletedIdentity === routeIdentity;
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

  useEffect(() => {
    routeVersion.current += 1;
    mutationLock.current = false;
    setEditOpen(false);
    setEditBusy(false);
    setDeleteArmed(false);
    setSourceRecord(null);
    setDeletedIdentity(
      deletedRoute.current === routeIdentity ? routeIdentity : undefined,
    );
    return () => {
      routeVersion.current += 1;
    };
  }, [routeIdentity]);

  useEffect(() => {
    if (!ownPending || deletedRoute.current === routeIdentity) return;
    setView((current) =>
      current?.identity === routeIdentity &&
      current.play.cid === ownPending.play.cid &&
      !current.syncing
        ? current
        : { identity: routeIdentity, play: ownPending.play, syncing: true },
    );
    setErrorState((current) =>
      current?.identity === routeIdentity && current.status === 404
        ? undefined
        : current,
    );
  }, [routeIdentity, ownPending?.play.cid]);

  useEffect(() => {
    let mounted = true;
    const version = ++requestVersion.current;
    setErrorState(undefined);
    setView((current) =>
      current?.identity === routeIdentity
        ? current
        : currentConfirmed.current
          ? {
              identity: routeIdentity,
              play: currentConfirmed.current,
              syncing: true,
            }
          : undefined,
    );
    async function load() {
      if (deletedRoute.current === routeIdentity) {
        setView(undefined);
        return;
      }
      if (!did || !rkey) {
        setErrorState({
          identity: routeIdentity,
          message: "This listen link is incomplete.",
        });
        return;
      }
      try {
        const result = await readListenDetail(
          did,
          rkey,
          viewerDid,
          () =>
            currentRoute.current === routeIdentity
              ? currentConfirmed.current
              : undefined,
          getPlayByAuthorRkey,
        );
        if (
          !mounted ||
          version !== requestVersion.current ||
          deletedRoute.current === routeIdentity
        )
          return;
        setView({
          identity: routeIdentity,
          play: result.play,
          syncing: result.syncing,
        });
        if (!result.syncing && latestEdit.current?.identity === routeIdentity)
          latestEdit.current = undefined;
        if (viewerDid === did && result.indexed)
          retireIndexedListens(did, [result.indexed]);
      } catch (cause) {
        if (
          !mounted ||
          version !== requestVersion.current ||
          deletedRoute.current === routeIdentity
        )
          return;
        setErrorState({
          identity: routeIdentity,
          status: cause instanceof XrpcError ? cause.status : undefined,
          message:
            cause instanceof XrpcError && cause.status === 404
              ? "This listen is not available. Check the link or try again in a moment."
              : "Teal could not load this listen. Check your connection and try again.",
        });
      }
    }
    void load();
    return () => {
      mounted = false;
      requestVersion.current += 1;
    };
  }, [did, rkey, viewerDid, retry]);

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
  const canManage = !!viewerDid && !!did && viewerDid === did && !!rkey;

  function captureMutation() {
    const version = routeVersion.current;
    const identity = routeIdentity;
    return () =>
      version === routeVersion.current && identity === currentRoute.current;
  }

  async function openEditor() {
    if (!canManage || !agent || !did || !rkey || !play || mutationLock.current)
      return;
    const stillCurrent = captureMutation();
    mutationLock.current = true;
    setEditBusy(true);
    setError(null);
    try {
      // Read the actual record and CID before editing. An unavailable PDS must not permit an unchecked overwrite.
      const loaded = await loadPlayRecord(agent, did, rkey);
      if (!stillCurrent()) return;
      setSourceRecord(loaded.record);
      setSwapRecord(loaded.swapRecord);
      setTrackName(loaded.record.trackName);
      setArtistsText(artistTextFromRecord(loaded.record));
      setReleaseName(loaded.record.releaseName || "");
      setPlayedTime(loaded.record.playedTime ? loaded.record.playedTime : "");
      setDeleteArmed(false);
      setEditOpen(true);
    } catch {
      if (stillCurrent())
        setError(
          "Could not open the editor. Your saved listen has not changed. Try again.",
        );
    } finally {
      if (stillCurrent()) {
        mutationLock.current = false;
        setEditBusy(false);
      }
    }
  }

  async function saveEdit() {
    if (
      !canManage ||
      !agent ||
      !did ||
      !rkey ||
      !uri ||
      !sourceRecord ||
      mutationLock.current
    )
      return;
    const stillCurrent = captureMutation();
    mutationLock.current = true;
    setEditBusy(true);
    setError(null);
    try {
      const record = applyEditableFields(sourceRecord, {
        trackName,
        artistsText,
        releaseName,
        playedTime,
      });
      const receipt = await putPlayRecord(agent, did, rkey, record, swapRecord);
      // Retire the old cached version even if the route changed while the write completed.
      removePendingListens(did, [uri]);
      if (receipt.uri === uri && receipt.cid)
        retainConfirmedListens(did, [
          {
            record: { ...record, $type: "fm.teal.feed.play" } as PlayRecord,
            ...receipt,
          },
        ]);
      if (!stillCurrent()) return;
      setSourceRecord(record);
      setSwapRecord(receipt.cid);
      if (play) {
        const updated: PlayView = {
          ...play,
          ...record,
          artists: record.artists || [],
          uri: uri as PlayView["uri"],
          cid: receipt.cid,
          $type: "fm.teal.feed.defs#playView",
        };
        latestEdit.current = { identity: routeIdentity, play: updated };
        currentConfirmed.current = updated;
        setView({ identity: routeIdentity, play: updated, syncing: true });
      }
      setEditOpen(false);
    } catch (cause) {
      if (stillCurrent())
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not save the changes. Try again.",
        );
    } finally {
      if (stillCurrent()) {
        mutationLock.current = false;
        setEditBusy(false);
      }
    }
  }

  async function deleteListen() {
    if (!canManage || !agent || !did || !rkey || !uri || mutationLock.current)
      return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    const stillCurrent = captureMutation();
    mutationLock.current = true;
    setEditBusy(true);
    setError(null);
    try {
      await deletePlayRecord(agent, did, rkey);
      deletedRoute.current = routeIdentity;
      if (latestEdit.current?.identity === routeIdentity)
        latestEdit.current = undefined;
      removePendingListens(did, [uri]);
      if (!stillCurrent()) return;
      setView(undefined);
      setDeletedIdentity(routeIdentity);
      setEditOpen(false);
    } catch {
      if (stillCurrent())
        setError("Could not delete this listen. Please try again.");
    } finally {
      if (stillCurrent()) {
        mutationLock.current = false;
        setEditBusy(false);
      }
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
    <TealShell
      rightRail={<RightRail />}
      pageTitle={play?.trackName || "Listen"}
    >
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
          <Text className="font-sans text-2xl font-black">Listen deleted.</Text>
          <Text className="mt-2 text-muted-foreground">
            Your listen has been removed from your account. Public feeds may
            take a moment to update.
          </Text>
        </View>
      )}
      {error &&
        (errorState?.kind === "action" ? (
          <View
            role="alert"
            className="mb-5 rounded-lg border border-border bg-card p-4"
          >
            <Text className="text-destructive">{error}</Text>
          </View>
        ) : (
          <LoadFailure
            title="Could not load listen"
            description={error}
            onRetry={() => setRetry((value) => value + 1)}
          />
        ))}
      {syncing && play && (
        <View
          role="status"
          className="mb-5 gap-3 rounded-lg border border-border bg-card p-4"
        >
          <Text className="font-bold">Saved, syncing</Text>
          <Text className="text-sm text-muted-foreground">
            This listen is saved to your account. Teal is still catching up. You
            are viewing your confirmed local copy.
          </Text>
          <Button
            variant="outline"
            className="self-start"
            onPress={() => setRetry((value) => value + 1)}
          >
            <Text>Check for updates</Text>
          </Button>
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
                  <Text
                    accessibilityRole="header"
                    aria-level={1}
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
                        Changes are saved to your account and may take a moment
                        to appear publicly.
                      </Text>
                    </View>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={editBusy}
                      accessibilityLabel="Close listen editor"
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
                      accessibilityLabel="Track name"
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
                      accessibilityLabel="Artists"
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
                      accessibilityLabel="Release name"
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
                      accessibilityLabel="Played time"
                      value={playedTime}
                      onChangeText={setPlayedTime}
                      editable={!editBusy}
                      inputMode="text"
                      placeholder="2026-10-17T12:30:00Z"
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

          <SectionHeading title="This listen" />
          <PlayFeedCard play={play} />
        </>
      )}
    </TealShell>
  );
}
