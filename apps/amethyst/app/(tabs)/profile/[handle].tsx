import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  View,
} from "react-native";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import EditProfileModal from "@/components/teal/EditProfileModal";
import { PlaylistCreator } from "@/components/teal/PlaylistControls";
import ProfileAlbumDeck from "@/components/teal/ProfileAlbumDeck";
import ProfileListeningRow from "@/components/teal/ProfileListeningRow";
import {
  normalizeStatsPeriod,
  ProfileStatsSections,
} from "@/components/teal/ProfileStats";
import RichText from "@/components/teal/RichText";
import RightRail from "@/components/teal/RightRail";
import SocialPostCard from "@/components/teal/SocialPostCard";
import TealShell from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { resolveHandle } from "@/lib/atp/pid";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  actorAvatarUrl,
  actorProfileHref,
  displayActorName,
  getCachedBlueskyProfile,
  getProfileImageUrl,
  normalizeHandle,
  type DisplayActor,
} from "@/lib/teal/actors";
import {
  coverArtUrl,
  displayArtists,
  getActorFeed,
  getActorPlaylists,
  getBlueskyProfile,
  getGraphFollowers,
  getGraphFollows,
  getGraphSummary,
  getProfile,
  getRecordingCoverArtUrl,
  getSocialFeed,
  XrpcError,
  type GraphSummaryView,
  type SocialPlaylistView,
  type SocialPostView,
} from "@/lib/teal/api";
import {
  artistsFromText,
  deletePlayRecord,
  loadPlayRecord,
  putPlayRecord,
} from "@/lib/teal/playRecords";
import {
  appendUniqueRecords,
  isCurrentProfileRequest,
} from "@/lib/teal/profileStats";
import { playlistHref } from "@/lib/teal/routes";
import { useStore } from "@/stores/mainStore";
import type { AppBskyActorDefs } from "@atproto/api";
import {
  CheckSquare,
  Pencil,
  Save,
  Square,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react-native";

import type {
  MiniProfileView,
  ProfileView,
} from "@teal/lexicons/src/fm/teal/actor/defs";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

type DisplayProfile = Pick<
  ProfileView,
  | "displayName"
  | "description"
  | "descriptionFacets"
  | "avatar"
  | "banner"
  | "status"
  | "statsDefaultPeriod"
> & {
  handle?: string;
};

function mergeBlueskyProfile(
  tealProfile: DisplayProfile,
  bskyProfile: AppBskyActorDefs.ProfileViewDetailed,
): DisplayProfile {
  return {
    ...tealProfile,
    avatar: tealProfile.avatar || bskyProfile.avatar,
    banner: tealProfile.banner || bskyProfile.banner,
    description: tealProfile.description || bskyProfile.description,
    displayName: tealProfile.displayName || bskyProfile.displayName,
    handle: tealProfile.handle || bskyProfile.handle,
  };
}

function needsBlueskyFallback(profile: DisplayProfile) {
  return (
    !profile.avatar ||
    !profile.banner ||
    !profile.description ||
    !profile.displayName ||
    !profile.handle
  );
}

function rkeyFromUri(uri?: string) {
  return uri?.split("/").pop();
}

function GraphActorRow({ actor }: { actor: MiniProfileView }) {
  const [blueskyActor, setBlueskyActor] = useState<DisplayActor>();
  const indexedActor = actor as DisplayActor;
  const did = indexedActor.did;
  const mergedActor = {
    ...blueskyActor,
    ...indexedActor,
    avatar: indexedActor.avatar || blueskyActor?.avatar,
    displayName: indexedActor.displayName || blueskyActor?.displayName,
    handle: indexedActor.handle || blueskyActor?.handle,
  };
  const href = actorProfileHref(mergedActor, did);
  const name = displayActorName(mergedActor, did);
  const handle = normalizeHandle(mergedActor.handle);
  const avatar = actorAvatarUrl(mergedActor, did);

  useEffect(() => {
    let mounted = true;
    if (!did || (indexedActor.displayName && indexedActor.handle)) {
      setBlueskyActor(undefined);
      return;
    }
    getCachedBlueskyProfile(did).then((profile) => {
      if (mounted) setBlueskyActor(profile);
    });
    return () => {
      mounted = false;
    };
  }, [did, indexedActor.displayName, indexedActor.handle]);

  return (
    <Link href={`/profile/${href}` as any} asChild>
      <Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-card/75 p-3 web:transition-colors web:hover:border-primary/45">
        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary">
          {avatar ? (
            <Image source={{ uri: avatar }} className="h-full w-full" />
          ) : (
            <Text className="text-lg font-black text-primary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-semibold" numberOfLines={1}>
            {name}
          </Text>
          {handle && (
            <Text
              className="font-mono text-xs text-muted-foreground"
              numberOfLines={1}
            >
              @{handle}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

export default function ProfileScreen() {
  const { handle, tab } = useLocalSearchParams();
  const router = useRouter();
  const tabValue = Array.isArray(tab) ? tab[0] : tab;
  const activeTab = ["listening", "posts", "playlists"].includes(tabValue || "")
    ? tabValue
    : "overview";
  const actor = Array.isArray(handle) ? handle[0] : handle;
  const [did, setDid] = useState<string | null>(null);
  const [profile, setProfile] = useState<DisplayProfile | null>(null);
  const [playlists, setPlaylists] = useState<SocialPlaylistView[]>([]);
  const [graphSummary, setGraphSummary] = useState<GraphSummaryView>({
    followersCount: 0,
    followsCount: 0,
  });
  const [graphTab, setGraphTab] = useState<"followers" | "following" | null>(
    null,
  );
  const [graphActors, setGraphActors] = useState<MiniProfileView[]>([]);
  const [graphCursor, setGraphCursor] = useState<string>();
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string>();
  const [profileLoading, setProfileLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [playsCursor, setPlaysCursor] = useState<string>();
  const [postsCursor, setPostsCursor] = useState<string>();
  const [playlistsCursor, setPlaylistsCursor] = useState<string>();
  const [sectionLoading, setSectionLoading] = useState({
    listening: true,
    posts: true,
    playlists: true,
  });
  const [sectionErrors, setSectionErrors] = useState<
    Partial<Record<"listening" | "posts" | "playlists", string>>
  >({});
  const [loadingMore, setLoadingMore] = useState(false);
  const requestVersion = useRef(0);
  const graphRequestVersion = useRef(0);
  const [posts, setPosts] = useState<SocialPostView[]>([]);
  const [plays, setPlays] = useState<PlayView[]>([]);
  const [followBusy, setFollowBusy] = useState(false);
  const followLock = useRef<object | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [selectedPlayRkeys, setSelectedPlayRkeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkArtistsText, setBulkArtistsText] = useState("");
  const [bulkReleaseName, setBulkReleaseName] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDeleteArmed, setBulkDeleteArmed] = useState(false);
  const [isBlueskyFallback, setIsBlueskyFallback] = useState(false);
  const [statusRecordingArt, setStatusRecordingArt] = useState<string>();
  const [statusArtFailed, setStatusArtFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdsAgent = useStore((state) => state.pdsAgent);
  const authStatus = useStore((state) => state.status);
  const currentIdentity = useRef({
    actor,
    targetDid: did,
    viewerDid: pdsAgent?.did,
  });
  currentIdentity.current = {
    actor,
    targetDid: did,
    viewerDid: authStatus === "loggedIn" ? pdsAgent?.did : undefined,
  };

  useEffect(() => {
    let mounted = true;
    requestVersion.current += 1;
    setError(null);
    setFollowBusy(false);
    followLock.current = null;
    setDid(null);
    setProfile(null);
    setProfileLoading(true);
    setBioExpanded(false);
    setGraphTab(null);
    setGraphSummary({ followersCount: 0, followsCount: 0 });
    setPlaylists([]);
    setPosts([]);
    setPlays([]);
    setPlaysCursor(undefined);
    setPostsCursor(undefined);
    setPlaylistsCursor(undefined);
    setSectionLoading({ listening: true, posts: true, playlists: true });
    setSectionErrors({});
    setSelectedPlayRkeys(new Set());
    setBulkEditOpen(false);
    setBulkDeleteArmed(false);
    setBulkArtistsText("");
    setBulkReleaseName("");
    setLoadingMore(false);

    async function load() {
      if (!actor) {
        setError("No listener was selected.");
        setProfileLoading(false);
        return;
      }
      try {
        const resolved = actor.startsWith("did:")
          ? actor
          : await resolveHandle(actor);
        if (!mounted) return;
        setDid(resolved);
        // Identity does not wait for history, posts, playlists, or graph requests.
        const identityRequest = (async () => {
          let nextProfile: DisplayProfile;
          let fallback = false;
          try {
            nextProfile = (await getProfile(resolved)).profile;
            fallback =
              !nextProfile.displayName &&
              !nextProfile.description &&
              !nextProfile.avatar &&
              !nextProfile.banner;
          } catch (cause) {
            if (!(cause instanceof XrpcError) || cause.status !== 404)
              throw cause;
            nextProfile = {
              handle: actor.startsWith("did:") ? undefined : actor,
            };
            fallback = true;
          }
          if (mounted) {
            setProfile(nextProfile);
            setIsBlueskyFallback(fallback);
            setProfileLoading(false);
          }
          if (needsBlueskyFallback(nextProfile)) {
            const bsky = await getBlueskyProfile(resolved).catch(() => null);
            if (bsky) nextProfile = mergeBlueskyProfile(nextProfile, bsky);
          }
          if (mounted) {
            setProfile(nextProfile);
            setIsBlueskyFallback(fallback);
          }
        })()
          .catch((cause) => {
            if (mounted)
              setError(cause instanceof Error ? cause.message : String(cause));
          })
          .finally(() => {
            if (mounted) setProfileLoading(false);
          });

        const listeningRequest = getActorFeed(resolved, 30).then((page) => {
          if (!mounted) return;
          setPlays(page.plays);
          setPlaysCursor(page.cursor);
        });
        const postsRequest = getSocialFeed(
          10,
          undefined,
          pdsAgent?.did,
          resolved,
        ).then((page) => {
          if (!mounted) return;
          setPosts(page.items);
          setPostsCursor(page.cursor);
        });
        const playlistsRequest = getActorPlaylists(resolved, 12).then(
          (page) => {
            if (!mounted) return;
            setPlaylists(page.items);
            setPlaylistsCursor(page.cursor);
          },
        );
        const sections = [
          ["listening", listeningRequest],
          ["posts", postsRequest],
          ["playlists", playlistsRequest],
        ] as const;
        for (const [section, request] of sections) {
          void request
            .catch((cause) => {
              if (mounted)
                setSectionErrors((current) => ({
                  ...current,
                  [section]:
                    cause instanceof Error ? cause.message : String(cause),
                }));
            })
            .finally(() => {
              if (mounted)
                setSectionLoading((current) => ({
                  ...current,
                  [section]: false,
                }));
            });
        }
        void getGraphSummary(resolved, pdsAgent?.did)
          .then((summary) => {
            if (mounted) setGraphSummary(summary);
          })
          .catch(() => undefined);
        await identityRequest;
      } catch (cause) {
        if (mounted) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setProfileLoading(false);
        }
      }
    }
    void load();
    return () => {
      mounted = false;
      requestVersion.current += 1;
    };
  }, [actor, pdsAgent?.did, refreshKey]);

  useEffect(() => {
    let mounted = true;
    graphRequestVersion.current += 1;
    setGraphActors([]);
    setGraphCursor(undefined);
    setGraphError(undefined);
    if (!did || !graphTab) return;
    setGraphLoading(true);
    const request =
      graphTab === "followers"
        ? getGraphFollowers(did, 20)
        : getGraphFollows(did, 20);
    request
      .then((page) => {
        if (!mounted) return;
        setGraphActors(page.actors);
        setGraphCursor(page.cursor);
      })
      .catch(() => {
        if (mounted)
          setGraphError("Could not load this list. Close it and try again.");
      })
      .finally(() => {
        if (mounted) setGraphLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [did, graphTab]);

  async function loadMore(section: "listening" | "posts" | "playlists") {
    const cursor =
      section === "listening"
        ? playsCursor
        : section === "posts"
          ? postsCursor
          : playlistsCursor;
    if (!did || !cursor || loadingMore) return;
    const version = requestVersion.current;
    setLoadingMore(true);
    try {
      if (section === "listening") {
        const page = await getActorFeed(did, 30, cursor);
        if (version !== requestVersion.current) return;
        setPlays((current) => appendUniqueRecords(current, page.plays));
        setPlaysCursor(page.cursor);
      } else if (section === "posts") {
        const page = await getSocialFeed(10, cursor, pdsAgent?.did, did);
        if (version !== requestVersion.current) return;
        setPosts((current) => appendUniqueRecords(current, page.items));
        setPostsCursor(page.cursor);
      } else {
        const page = await getActorPlaylists(did, 12, cursor);
        if (version !== requestVersion.current) return;
        setPlaylists((current) => appendUniqueRecords(current, page.items));
        setPlaylistsCursor(page.cursor);
      }
    } catch {
      if (version === requestVersion.current)
        setSectionErrors((current) => ({
          ...current,
          [section]: "Could not load more. Try again.",
        }));
    } finally {
      if (version === requestVersion.current) setLoadingMore(false);
    }
  }

  async function loadMoreGraph() {
    if (!did || !graphTab || !graphCursor || graphLoading) return;
    const version = requestVersion.current;
    const graphVersion = graphRequestVersion.current;
    setGraphLoading(true);
    try {
      const page = await (graphTab === "followers"
        ? getGraphFollowers(did, 20, graphCursor)
        : getGraphFollows(did, 20, graphCursor));
      if (
        version !== requestVersion.current ||
        graphVersion !== graphRequestVersion.current
      )
        return;
      setGraphActors((current) => {
        const known = new Set(current.map((item) => item.did));
        return [
          ...current,
          ...page.actors.filter((item) => !known.has(item.did)),
        ];
      });
      setGraphCursor(page.cursor);
    } catch {
      if (
        version === requestVersion.current &&
        graphVersion === graphRequestVersion.current
      )
        setGraphError("Could not load more people. Try again.");
    } finally {
      if (
        version === requestVersion.current &&
        graphVersion === graphRequestVersion.current
      )
        setGraphLoading(false);
    }
  }

  const isSelf = did === pdsAgent?.did;
  const selectedPlayCount = selectedPlayRkeys.size;
  const viewerFollowing = graphSummary.viewerFollowing;
  const canFollow = authStatus === "loggedIn" && !!pdsAgent?.did && !!did;
  async function toggleFollow() {
    if (!canFollow || !pdsAgent?.did || !did || isSelf || followLock.current)
      return;
    const request = {
      generation: requestVersion.current,
      actor,
      targetDid: did,
      viewerDid: pdsAgent.did,
    };
    const operation = {};
    followLock.current = operation;
    const stillCurrent = () =>
      isCurrentProfileRequest(request, {
        generation: requestVersion.current,
        ...currentIdentity.current,
      });
    setFollowBusy(true);
    try {
      if (viewerFollowing) {
        const rkey = rkeyFromUri(viewerFollowing);
        if (!rkey) throw new Error("Could not resolve follow rkey");
        await pdsAgent.call(
          "com.atproto.repo.deleteRecord",
          {},
          {
            repo: pdsAgent.did,
            collection: "fm.teal.graph.follow",
            rkey,
          },
        );
        if (!stillCurrent()) return;
        setGraphSummary((current) => ({
          ...current,
          followersCount: Math.max(0, current.followersCount - 1),
          viewerFollowing: undefined,
        }));
        return;
      }

      const res = await pdsAgent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: pdsAgent.did,
          collection: "fm.teal.graph.follow",
          record: {
            $type: "fm.teal.graph.follow",
            subject: did,
            createdAt: new Date().toISOString(),
          },
        },
      );
      if (!stillCurrent()) return;
      setGraphSummary((current) => ({
        ...current,
        followersCount: current.followersCount + 1,
        viewerFollowing: (res.data as { uri?: string }).uri,
      }));
    } catch (e) {
      if (stillCurrent()) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (followLock.current === operation) followLock.current = null;
      if (stillCurrent()) setFollowBusy(false);
    }
  }

  function toggleBulkEdit() {
    setBulkEditOpen((current) => !current);
    setSelectedPlayRkeys(new Set());
    setBulkDeleteArmed(false);
    setBulkArtistsText("");
    setBulkReleaseName("");
  }

  function togglePlaySelection(rkey?: string) {
    if (!rkey || bulkBusy) return;
    setBulkDeleteArmed(false);
    setSelectedPlayRkeys((current) => {
      const next = new Set(current);
      if (next.has(rkey)) {
        next.delete(rkey);
      } else {
        next.add(rkey);
      }
      return next;
    });
  }

  function selectVisiblePlays() {
    setBulkDeleteArmed(false);
    const visibleRkeys = plays
      .map((play) => play.rkey)
      .filter((rkey): rkey is string => !!rkey);
    setSelectedPlayRkeys(new Set(visibleRkeys));
  }

  async function deleteSelectedPlays() {
    if (!pdsAgent?.did || !did || selectedPlayCount === 0 || bulkBusy) return;
    if (!bulkDeleteArmed) {
      setBulkDeleteArmed(true);
      return;
    }
    setBulkBusy(true);
    setError(null);
    try {
      const rkeys = Array.from(selectedPlayRkeys);
      for (const selectedRkey of rkeys) {
        await deletePlayRecord(pdsAgent, did, selectedRkey);
      }
      setPlays((current) =>
        current.filter(
          (play) => !play.rkey || !selectedPlayRkeys.has(play.rkey),
        ),
      );
      setSelectedPlayRkeys(new Set());
      setBulkDeleteArmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }

  async function updateSelectedPlays() {
    if (!pdsAgent?.did || !did || selectedPlayCount === 0 || bulkBusy) return;
    const nextArtists = bulkArtistsText.trim();
    const nextRelease = bulkReleaseName.trim();
    if (!nextArtists && !nextRelease) {
      setError("Enter artists or release text before applying a bulk edit.");
      return;
    }

    setBulkBusy(true);
    setError(null);
    try {
      const selected = new Set(selectedPlayRkeys);
      for (const selectedRkey of selected) {
        const loaded = await loadPlayRecord(pdsAgent, did, selectedRkey);
        await putPlayRecord(
          pdsAgent,
          did,
          selectedRkey,
          {
            ...loaded.record,
            ...(nextArtists ? { artists: artistsFromText(nextArtists) } : {}),
            ...(nextRelease ? { releaseName: nextRelease } : {}),
          },
          loaded.swapRecord,
        );
      }
      setPlays((current) =>
        current.map((play) => {
          if (!play.rkey || !selected.has(play.rkey)) return play;
          return {
            ...play,
            ...(nextArtists ? { artists: artistsFromText(nextArtists) } : {}),
            ...(nextRelease ? { releaseName: nextRelease } : {}),
          };
        }),
      );
      setSelectedPlayRkeys(new Set());
      setBulkArtistsText("");
      setBulkReleaseName("");
      setBulkDeleteArmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }
  const avatarUrl = did
    ? getProfileImageUrl(did, profile?.avatar, "avatar")
    : undefined;
  const bannerUrl = did
    ? getProfileImageUrl(did, profile?.banner, "banner")
    : undefined;
  const currentStatus = profile?.status?.item;
  const currentStatusReleaseArt = coverArtUrl(currentStatus?.releaseMbId, 100);
  const currentStatusArt = statusArtFailed
    ? undefined
    : currentStatusReleaseArt || statusRecordingArt;

  useEffect(() => {
    let mounted = true;
    setStatusArtFailed(false);
    if (
      !currentStatus ||
      currentStatusReleaseArt ||
      !currentStatus.recordingMbId
    ) {
      setStatusRecordingArt(undefined);
      return;
    }
    getRecordingCoverArtUrl(currentStatus.recordingMbId, 100).then((url) => {
      if (mounted) setStatusRecordingArt(url);
    });
    return () => {
      mounted = false;
    };
  }, [currentStatus, currentStatusReleaseArt]);

  function handleTabKey(
    event: KeyboardEvent<HTMLElement>,
    selectedIndex: number,
  ) {
    const tabs = ["overview", "listening", "posts", "playlists"];
    const nextIndex =
      event.key === "ArrowRight"
        ? (selectedIndex + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (selectedIndex + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : undefined;
    if (nextIndex === undefined) return;
    event.preventDefault();
    router.setParams({ tab: tabs[nextIndex] });
    setBulkEditOpen(false);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [nextIndex]?.focus();
  }

  const displayName =
    profile?.displayName ||
    profile?.handle ||
    (actor?.startsWith("did:") ? "Listener" : actor) ||
    "Listener";
  const description = profile?.description || "";
  const longBio =
    description.length > 180 || description.split("\n").length > 3;
  const period = normalizeStatsPeriod(profile?.statsDefaultPeriod);
  const sectionStatus = (section: "listening" | "posts" | "playlists") =>
    sectionLoading[section] ? (
      <View className="py-6">
        <ActivityIndicator accessibilityLabel={`Loading ${section}`} />
      </View>
    ) : sectionErrors[section] ? (
      <View className="mb-4 gap-3">
        <Text className="text-destructive">
          Could not load {section}. Please try again.
        </Text>
        <Button
          variant="outline"
          className="self-start"
          onPress={() => setRefreshKey((key) => key + 1)}
        >
          <Text>Try again</Text>
        </Button>
      </View>
    ) : null;
  const emptyListening = (
    <View className="gap-3 py-3">
      <Text className="font-bold">No listens yet</Text>
      <Text className="text-sm text-muted-foreground">
        {isSelf
          ? "Add a track or an album to start your listening history. Saved listens can take a moment to appear."
          : "This listener has not shared any listens yet."}
      </Text>
      {isSelf && (
        <Link href="/manual-listens" asChild>
          <Button className="self-start">
            <Text>Add your first listen</Text>
          </Button>
        </Link>
      )}
    </View>
  );

  const profileActions = (
    <View className="flex-row flex-wrap justify-center gap-2">
      {isSelf ? (
        <>
          <Link href="/manual-listens" asChild>
            <Button size="sm">
              <Text>Add a listen</Text>
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="flex-row gap-2"
            onPress={() => setEditProfileOpen(true)}
          >
            <Icon icon={Pencil} size={15} />
            <Text>Edit profile</Text>
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          className="flex-row gap-2"
          variant={viewerFollowing ? "outline" : "default"}
          disabled={!canFollow || followBusy}
          onPress={toggleFollow}
        >
          <Icon icon={viewerFollowing ? UserMinus : UserPlus} size={15} />
          <Text>
            {followBusy ? "Saving" : viewerFollowing ? "Following" : "Follow"}
          </Text>
        </Button>
      )}
    </View>
  );

  return (
    <TealShell rightRail={<RightRail />} pageTitle={displayName}>
      <Stack.Screen options={{ title: displayName, headerShown: false }} />
      {profileLoading && (
        <View className="min-h-48 items-center justify-center">
          <ActivityIndicator
            size="large"
            accessibilityLabel="Loading profile"
          />
        </View>
      )}
      {error && (
        <View className="mb-5 gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            {did
              ? "We could not complete that action."
              : "This profile could not be found."}
          </Text>
          <Text className="text-sm text-muted-foreground">
            Check the handle or try again in a moment.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Button
              variant="outline"
              onPress={() => setRefreshKey((key) => key + 1)}
            >
              <Text>Try again</Text>
            </Button>
            <Link href="/search" asChild>
              <Button variant="outline">
                <Text>Find a listener</Text>
              </Button>
            </Link>
          </View>
        </View>
      )}
      {did && !profileLoading && (
        <>
          <View className="mb-5 overflow-hidden rounded-lg border border-border bg-card">
            <View className="relative bg-accent/60">
              {bannerUrl && (
                <Image
                  source={{ uri: bannerUrl }}
                  className="absolute inset-0 h-full w-full"
                  resizeMode="cover"
                />
              )}
              <ProfileAlbumDeck
                key={`${did}-${period}`}
                actor={did}
                period={period}
                avatarUrl={avatarUrl}
                displayName={displayName}
              />
            </View>
            <View className="gap-2 px-4 pb-4 pt-[18px] md:px-5 md:pb-5">
              <View className="items-center">
                <View className="w-full min-w-0 items-center">
                  <Text
                    accessibilityRole="header"
                    aria-level={1}
                    className="var-font-soft text-center font-accent text-3xl font-semibold"
                    numberOfLines={2}
                  >
                    {displayName}
                  </Text>
                  {profile?.handle && (
                    <Text
                      className="text-sm text-muted-foreground"
                      numberOfLines={1}
                    >
                      @{normalizeHandle(profile.handle)}
                    </Text>
                  )}
                  <View className="flex-row flex-wrap items-center justify-center gap-x-3">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${graphSummary.followersCount} followers`}
                      className="min-h-11 justify-center"
                      onPress={() =>
                        setGraphTab((current) =>
                          current === "followers" ? null : "followers",
                        )
                      }
                    >
                      <Text className="text-sm">
                        <Text className="font-bold">
                          {graphSummary.followersCount}
                        </Text>{" "}
                        followers
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Following ${graphSummary.followsCount} people`}
                      className="min-h-11 justify-center"
                      onPress={() =>
                        setGraphTab((current) =>
                          current === "following" ? null : "following",
                        )
                      }
                    >
                      <Text className="text-sm">
                        <Text className="font-bold">
                          {graphSummary.followsCount}
                        </Text>{" "}
                        following
                      </Text>
                    </Pressable>
                    {profileActions}
                  </View>
                </View>
              </View>
              {description && (
                <View>
                  {bioExpanded || !longBio ? (
                    <RichText
                      text={description}
                      facets={profile?.descriptionFacets}
                      className="text-sm leading-6"
                    />
                  ) : (
                    <Text className="text-sm leading-6" numberOfLines={3}>
                      {description}
                    </Text>
                  )}
                  {longBio && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: bioExpanded }}
                      accessibilityLabel={
                        bioExpanded
                          ? "Show less biography"
                          : "Read full biography"
                      }
                      className="min-h-11 justify-center self-start"
                      onPress={() => setBioExpanded((value) => !value)}
                    >
                      <Text className="text-sm font-semibold text-primary">
                        {bioExpanded ? "Show less" : "Read more"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
              {currentStatus && (
                <View className="flex-row items-center gap-2 border-t border-border pt-3">
                  <View className="h-9 w-9 overflow-hidden rounded-md bg-muted">
                    {currentStatusArt && (
                      <Image
                        source={{ uri: currentStatusArt }}
                        className="h-full w-full"
                        onError={() => setStatusArtFailed(true)}
                      />
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-bold" numberOfLines={1}>
                      Listening to {currentStatus.trackName}
                    </Text>
                    <Text
                      className="text-xs text-muted-foreground"
                      numberOfLines={1}
                    >
                      {displayArtists(currentStatus)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
          {graphTab && (
            <View className="mb-5 gap-3 border-b border-border pb-5">
              <View className="flex-row items-center justify-between">
                <Text
                  accessibilityRole="header"
                  aria-level={2}
                  className="text-xl font-bold"
                >
                  {graphTab === "followers" ? "Followers" : "Following"}
                </Text>
                <Button
                  size="icon"
                  variant="ghost"
                  accessibilityLabel="Close people list"
                  onPress={() => setGraphTab(null)}
                >
                  <Icon icon={X} size={18} />
                </Button>
              </View>
              {graphError && (
                <Text className="text-destructive">{graphError}</Text>
              )}
              {graphLoading && graphActors.length === 0 ? (
                <ActivityIndicator />
              ) : graphActors.length === 0 && !graphError ? (
                <Text className="text-muted-foreground">
                  {graphTab === "followers"
                    ? "No followers yet."
                    : "Not following anyone yet."}
                </Text>
              ) : (
                graphActors.map((person) => (
                  <GraphActorRow
                    key={person.did || person.handle}
                    actor={person}
                  />
                ))
              )}
              {graphCursor && (
                <Button
                  variant="outline"
                  disabled={graphLoading}
                  onPress={loadMoreGraph}
                >
                  <Text>{graphLoading ? "Loading" : "Load more people"}</Text>
                </Button>
              )}
            </View>
          )}
          {isSelf && (
            <EditProfileModal
              did={did}
              profile={profile}
              visible={editProfileOpen}
              onClose={() => setEditProfileOpen(false)}
              onSaved={(updatedProfile) => {
                setProfile((current) => ({
                  ...(current || {}),
                  ...updatedProfile,
                }));
                setIsBlueskyFallback(false);
              }}
            />
          )}
          <View
            accessibilityRole="tablist"
            className="mb-5 flex-row border-b border-border"
          >
            {(["overview", "listening", "posts", "playlists"] as const).map(
              (value, index) => (
                <Pressable
                  key={value}
                  nativeID={`profile-tab-${value}`}
                  {...(Platform.OS === "web"
                    ? {
                        tabIndex: activeTab === value ? 0 : -1,
                        "aria-controls": "profile-content",
                        onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
                          handleTabKey(event, index),
                      }
                    : {})}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === value }}
                  accessibilityLabel={
                    value.charAt(0).toUpperCase() + value.slice(1)
                  }
                  className={`min-h-12 min-w-0 flex-1 items-center justify-center border-b-2 px-1 ${activeTab === value ? "border-primary" : "border-transparent"}`}
                  onPress={() => {
                    router.setParams({ tab: value });
                    setBulkEditOpen(false);
                  }}
                >
                  <Text
                    className={`text-sm font-bold ${activeTab === value ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
          <View
            nativeID="profile-content"
            {...(Platform.OS === "web"
              ? {
                  role: "tabpanel" as const,
                  "aria-labelledby": `profile-tab-${activeTab}`,
                }
              : {})}
          >
            {activeTab === "overview" && (
              <>
                {isSelf && isBlueskyFallback && (
                  <View className="mb-5 gap-3 border-b border-border pb-5">
                    <Text
                      accessibilityRole="header"
                      aria-level={2}
                      className="text-lg font-bold"
                    >
                      Make this profile yours
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      Your Bluesky details are here to get you started. Add your
                      Teal name, bio, and artwork.
                    </Text>
                    <Link href="/onboarding" asChild>
                      <Button variant="outline" className="self-start">
                        <Text>Set up your Teal profile</Text>
                      </Button>
                    </Link>
                  </View>
                )}
                <View className="mb-6">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text
                      accessibilityRole="header"
                      aria-level={2}
                      className="text-xl font-bold"
                    >
                      Recent listening
                    </Text>
                    {plays.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => router.setParams({ tab: "listening" })}
                      >
                        <Text>View all</Text>
                      </Button>
                    )}
                  </View>
                  {sectionStatus("listening") ||
                    (plays.length
                      ? plays
                          .slice(0, 3)
                          .map((play) => (
                            <ProfileListeningRow key={play.uri} play={play} />
                          ))
                      : emptyListening)}
                </View>
                {plays.length > 0 && (
                  <ProfileStatsSections
                    actor={did}
                    defaultPeriod={period}
                    compact
                    plays={plays}
                  />
                )}
                {playlists.length > 0 && (
                  <View className="mb-6">
                    <Text
                      accessibilityRole="header"
                      aria-level={2}
                      className="mb-3 text-xl font-bold"
                    >
                      Playlists
                    </Text>
                    <Link
                      href={
                        playlistHref(playlists[0].name, playlists[0].uri) as any
                      }
                      asChild
                    >
                      <Button
                        variant="outline"
                        className="h-auto items-start p-4"
                      >
                        <Text className="font-bold">{playlists[0].name}</Text>
                        <Text className="text-sm text-muted-foreground">
                          {playlists[0].itemCount} tracks
                        </Text>
                      </Button>
                    </Link>
                  </View>
                )}
                {posts.length > 0 && (
                  <View className="mb-6">
                    <View className="mb-3 flex-row items-center justify-between">
                      <Text
                        accessibilityRole="header"
                        aria-level={2}
                        className="text-xl font-bold"
                      >
                        Latest post
                      </Text>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => router.setParams({ tab: "posts" })}
                      >
                        <Text>View all</Text>
                      </Button>
                    </View>
                    <SocialPostCard
                      post={posts[0]}
                      onDeleted={(uri) =>
                        setPosts((current) =>
                          current.filter((post) => post.uri !== uri),
                        )
                      }
                    />
                  </View>
                )}
              </>
            )}
            {activeTab === "listening" && (
              <>
                <View className="mb-6 flex-row flex-wrap items-center justify-between gap-3">
                  <Text
                    accessibilityRole="header"
                    aria-level={2}
                    className="text-xl font-bold"
                  >
                    Listening history
                  </Text>
                  {isSelf && plays.length > 0 && (
                    <Button
                      size="sm"
                      variant={bulkEditOpen ? "default" : "outline"}
                      disabled={bulkBusy}
                      onPress={toggleBulkEdit}
                    >
                      <Icon
                        icon={bulkEditOpen ? CheckSquare : Square}
                        size={16}
                      />
                      <Text>
                        {bulkEditOpen ? "Done selecting" : "Select listens"}
                      </Text>
                    </Button>
                  )}
                </View>
                {bulkEditOpen && isSelf && (
                  <View className="mb-4 gap-3 rounded-lg border border-border bg-card/75 p-4">
                    <View className="flex-row flex-wrap items-center justify-between gap-3">
                      <View>
                        <Text className="font-bold">
                          {selectedPlayCount} selected
                        </Text>
                        <Text className="text-sm text-muted-foreground">
                          Changes are saved to your account.
                        </Text>
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bulkBusy}
                          onPress={selectVisiblePlays}
                        >
                          <Text>Select visible</Text>
                        </Button>
                        <Button
                          variant={bulkDeleteArmed ? "destructive" : "outline"}
                          size="sm"
                          className="flex-row gap-2"
                          disabled={bulkBusy || selectedPlayCount === 0}
                          onPress={deleteSelectedPlays}
                        >
                          <Icon icon={Trash2} size={15} />
                          <Text>
                            {bulkDeleteArmed
                              ? "Confirm delete"
                              : "Delete selected"}
                          </Text>
                        </Button>
                      </View>
                    </View>
                    <View className="grid-cols-1 gap-3 md:grid md:grid-cols-2">
                      <View className="gap-2">
                        <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                          Artists
                        </Text>
                        <Input
                          value={bulkArtistsText}
                          onChangeText={setBulkArtistsText}
                          editable={!bulkBusy}
                          placeholder="Artist, Featured artist"
                        />
                      </View>
                      <View className="gap-2">
                        <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                          Album or single
                        </Text>
                        <Input
                          value={bulkReleaseName}
                          onChangeText={setBulkReleaseName}
                          editable={!bulkBusy}
                          placeholder="Album or single"
                        />
                      </View>
                    </View>
                    <Button
                      className="flex-row gap-2 self-start"
                      disabled={
                        bulkBusy ||
                        selectedPlayCount === 0 ||
                        (!bulkArtistsText.trim() && !bulkReleaseName.trim())
                      }
                      onPress={updateSelectedPlays}
                    >
                      <Icon icon={Save} size={15} />
                      <Text>Apply to selected</Text>
                    </Button>
                  </View>
                )}

                {sectionStatus("listening")}
                {!sectionLoading.listening &&
                  !sectionErrors.listening &&
                  plays.length === 0 &&
                  emptyListening}
                {plays.map((play, index) => (
                  <View
                    key={play.uri || `${play.trackName}-${index}`}
                    className="flex-row items-center gap-3"
                  >
                    {bulkEditOpen && (
                      <Button
                        size="icon"
                        variant={
                          play.rkey && selectedPlayRkeys.has(play.rkey)
                            ? "default"
                            : "outline"
                        }
                        disabled={!play.rkey || bulkBusy}
                        accessibilityLabel={`Select ${play.trackName}`}
                        accessibilityState={{
                          selected:
                            !!play.rkey && selectedPlayRkeys.has(play.rkey),
                        }}
                        onPress={() => togglePlaySelection(play.rkey)}
                      >
                        <Icon
                          icon={
                            play.rkey && selectedPlayRkeys.has(play.rkey)
                              ? CheckSquare
                              : Square
                          }
                          size={18}
                        />
                      </Button>
                    )}
                    <View className="min-w-0 flex-1">
                      <ProfileListeningRow play={play} />
                    </View>
                  </View>
                ))}
                {playsCursor && (
                  <Button
                    variant="outline"
                    className="my-5 self-center"
                    disabled={loadingMore}
                    onPress={() => loadMore("listening")}
                  >
                    <Text>{loadingMore ? "Loading" : "Load more listens"}</Text>
                  </Button>
                )}
                {plays.length > 0 && (
                  <View className="mt-6">
                    <ProfileStatsSections
                      actor={did}
                      defaultPeriod={period}
                      plays={plays}
                    />
                  </View>
                )}
              </>
            )}
            {activeTab === "posts" && (
              <View className="gap-3">
                <Text
                  accessibilityRole="header"
                  aria-level={2}
                  className="text-xl font-bold"
                >
                  Posts
                </Text>
                {sectionStatus("posts")}
                {!sectionLoading.posts &&
                  !sectionErrors.posts &&
                  posts.length === 0 && (
                    <View className="gap-3 py-3">
                      <Text className="text-muted-foreground">
                        {isSelf
                          ? "Share a song or say what you have been listening to."
                          : "No posts yet."}
                      </Text>
                      {isSelf && (
                        <Link href="/" asChild>
                          <Button variant="outline" className="self-start">
                            <Text>Write a post</Text>
                          </Button>
                        </Link>
                      )}
                    </View>
                  )}
                {posts.map((post) => (
                  <SocialPostCard
                    key={post.uri}
                    post={post}
                    onDeleted={(uri) =>
                      setPosts((current) =>
                        current.filter((item) => item.uri !== uri),
                      )
                    }
                  />
                ))}
                {postsCursor && (
                  <Button
                    variant="outline"
                    className="my-5 self-center"
                    disabled={loadingMore}
                    onPress={() => loadMore("posts")}
                  >
                    <Text>{loadingMore ? "Loading" : "Load more posts"}</Text>
                  </Button>
                )}
              </View>
            )}
            {activeTab === "playlists" && (
              <View className="gap-4">
                <Text
                  accessibilityRole="header"
                  aria-level={2}
                  className="text-xl font-bold"
                >
                  Playlists
                </Text>
                {isSelf && (
                  <PlaylistCreator
                    onCreated={(playlist) =>
                      setPlaylists((current) => [playlist, ...current])
                    }
                  />
                )}
                {sectionStatus("playlists")}
                {!sectionLoading.playlists &&
                  !sectionErrors.playlists &&
                  playlists.length === 0 && (
                    <Text className="text-muted-foreground">
                      {isSelf
                        ? "Collect favorite tracks in your first playlist."
                        : "No playlists yet."}
                    </Text>
                  )}
                {playlists.map((playlist) => (
                  <Link
                    key={playlist.uri}
                    href={playlistHref(playlist.name, playlist.uri) as any}
                    asChild
                  >
                    <Button
                      variant="outline"
                      className="h-auto items-start p-4"
                    >
                      <Text className="font-bold" numberOfLines={2}>
                        {playlist.name}
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        {playlist.itemCount} tracks
                      </Text>
                    </Button>
                  </Link>
                ))}
                {playlistsCursor && (
                  <Button
                    variant="outline"
                    className="my-5 self-center"
                    disabled={loadingMore}
                    onPress={() => loadMore("playlists")}
                  >
                    <Text>
                      {loadingMore ? "Loading" : "Load more playlists"}
                    </Text>
                  </Button>
                )}
              </View>
            )}
          </View>
        </>
      )}
    </TealShell>
  );
}
