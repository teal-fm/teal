import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  View,
} from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import PlayFeedCard from "@/components/teal/PlayFeedCard";
import BadgeManager from "@/components/teal/BadgeManager";
import EditProfileModal from "@/components/teal/EditProfileModal";
import { PlaylistCreator } from "@/components/teal/PlaylistControls";
import { ProfileStatsSections } from "@/components/teal/ProfileStats";
import RichText from "@/components/teal/RichText";
import RightRail from "@/components/teal/RightRail";
import SocialPostCard from "@/components/teal/SocialPostCard";
import TealShell, {
  SectionHeading,
} from "@/components/teal/TealShell";
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
  getActorFeed,
  getActorBadges,
  getActorPlaylists,
  getBlueskyProfile,
  getGraphFollowers,
  getGraphFollows,
  getGraphSummary,
  getProfile,
  getUserTopReleases,
  getSocialFeed,
  coverArtUrl,
  displayArtists,
  getRecordingCoverArtUrl,
  type GraphSummaryView,
  type SocialBadgeAssignmentView,
  type SocialPostView,
  type SocialPlaylistView,
  type StatsPeriod,
  XrpcError,
} from "@/lib/teal/api";
import {
  artistsFromText,
  deletePlayRecord,
  loadPlayRecord,
  putPlayRecord,
} from "@/lib/teal/playRecords";
import { useStore } from "@/stores/mainStore";
import { musicAlbumHref, playlistHref } from "@/lib/teal/routes";
import type { AppBskyActorDefs } from "@atproto/api";
import {
  CheckSquare,
  Disc3,
  Info,
  Pencil,
  Save,
  Square,
  Trash2,
  UserMinus,
  UserPlus,
  UserRoundPlus,
  Users,
} from "lucide-react-native";

import type {
  MiniProfileView,
  ProfileView,
} from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";
import type { ReleaseView } from "@teal/lexicons/src/types/fm/teal/alpha/stats/defs";

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

function normalizeStatsPeriod(value?: string): StatsPeriod {
  return ["7days", "30days", "90days", "180days", "365days", "all"].includes(
    value || "",
  )
    ? (value as StatsPeriod)
    : "90days";
}

function ProfileAlbumTile({
  release,
  index,
}: {
  release: ReleaseView;
  index: number;
}) {
  const [failed, setFailed] = useState(false);
  const art = failed ? undefined : coverArtUrl(release.mbid, 100);
  const href = release.mbid
    ? musicAlbumHref("music", release.name || "Unknown album", release.mbid)
    : undefined;
  const positions = [
    { left: 4, top: 2, transform: [{ rotate: "-8deg" }] },
    { left: 0, top: 76, transform: [{ rotate: "7deg" }] },
    { right: 14, top: 0, transform: [{ rotate: "9deg" }] },
    { right: 0, top: 82, transform: [{ rotate: "-6deg" }] },
  ];
  const content = (
    <Pressable
      accessibilityLabel={`${release.name || "Album"}: ${release.playCount || 0} plays`}
      className="absolute h-14 w-14 items-center justify-center overflow-hidden rounded-md border-2 border-background bg-muted shadow-sm web:transition-transform web:hover:scale-105"
      style={positions[index]}
    >
      {art ? (
        <Image
          source={{ uri: art }}
          className="h-full w-full"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon icon={Disc3} size={22} className="text-muted-foreground" />
      )}
    </Pressable>
  );

  return href ? (
    <Link href={href as any} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}

function ProfileAvatarCluster({
  avatarUrl,
  fallback,
  topReleases,
}: {
  avatarUrl?: string;
  fallback: string;
  topReleases: ReleaseView[];
}) {
  const albumTiles = topReleases.slice(0, 4);
  const avatar = avatarUrl ? (
    <Image
      source={{ uri: avatarUrl }}
      className="h-24 w-24 rounded-lg border-4 border-background bg-primary"
    />
  ) : (
    <View className="h-24 w-24 items-center justify-center rounded-lg border-4 border-background bg-primary">
      <Text className="text-4xl font-black text-primary-foreground">
        {fallback.slice(0, 1)}
      </Text>
    </View>
  );

  if (albumTiles.length === 0) {
    return avatar;
  }

  return (
    <View className="relative h-36 w-56">
      {albumTiles.map((release, index) => (
        <ProfileAlbumTile
          key={`${release.mbid || release.name}-${index}`}
          release={release}
          index={index}
        />
      ))}
      <View className="absolute left-[4.25rem] top-5">{avatar}</View>
    </View>
  );
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
      <Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-white/65 p-3 web:transition-colors web:hover:border-primary/45">
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
  const { handle } = useLocalSearchParams();
  const actor = Array.isArray(handle) ? handle[0] : handle;
  const [did, setDid] = useState<string | null>(null);
  const [profile, setProfile] = useState<DisplayProfile | null>(null);
  const [badges, setBadges] = useState<SocialBadgeAssignmentView[]>([]);
  const [playlists, setPlaylists] = useState<SocialPlaylistView[]>([]);
  const [topReleases, setTopReleases] = useState<ReleaseView[]>([]);
  const [graphSummary, setGraphSummary] = useState<GraphSummaryView>({
    followersCount: 0,
    followsCount: 0,
  });
  const [followers, setFollowers] = useState<MiniProfileView[]>([]);
  const [follows, setFollows] = useState<MiniProfileView[]>([]);
  const [graphTab, setGraphTab] = useState<"followers" | "following">(
    "followers",
  );
  const [posts, setPosts] = useState<SocialPostView[]>([]);
  const [plays, setPlays] = useState<PlayView[]>([]);
  const [followBusy, setFollowBusy] = useState(false);
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

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!actor) return;
      try {
        setError(null);
        setDid(null);
        setProfile(null);
        setBadges([]);
        setPlaylists([]);
        setTopReleases([]);
        setGraphSummary({ followersCount: 0, followsCount: 0 });
        setFollowers([]);
        setFollows([]);
        setPosts([]);
        setPlays([]);
        setSelectedPlayRkeys(new Set());
        setBulkEditOpen(false);
        setBulkDeleteArmed(false);
        setBulkArtistsText("");
        setBulkReleaseName("");
        const resolved = actor.startsWith("did:")
          ? actor
          : await resolveHandle(actor);
        if (!mounted) return;
        setDid(resolved);
        const feedRes = await getActorFeed(resolved, 10);
        const postsRes = await getSocialFeed(
          10,
          undefined,
          pdsAgent?.did,
          resolved,
        ).catch(() => ({
          items: [],
        }));
        const badgeRes = await getActorBadges(resolved, 12).catch(() => ({
          items: [],
        }));
        const playlistRes = await getActorPlaylists(resolved, 12).catch(() => ({
          items: [],
        }));
        const graphSummaryRes = await getGraphSummary(
          resolved,
          pdsAgent?.did,
        ).catch(() => ({
          followersCount: 0,
          followsCount: 0,
        }));
        const followersRes = await getGraphFollowers(resolved, 12).catch(
          () => ({
            actors: [],
          }),
        );
        const followsRes = await getGraphFollows(resolved, 12).catch(() => ({
          actors: [],
        }));
        let nextProfile: DisplayProfile | null = null;
        let nextIsBlueskyFallback = false;

        try {
          nextProfile = (await getProfile(resolved)).profile;
          if (needsBlueskyFallback(nextProfile)) {
            const bskyProfile = await getBlueskyProfile(resolved).catch(
              () => null,
            );
            if (bskyProfile) {
              nextIsBlueskyFallback =
                !nextProfile.displayName &&
                !nextProfile.description &&
                !nextProfile.avatar &&
                !nextProfile.banner;
              nextProfile = mergeBlueskyProfile(nextProfile, bskyProfile);
            }
          }
        } catch (profileError) {
          if (
            !(profileError instanceof XrpcError) ||
            profileError.status !== 404
          ) {
            throw profileError;
          }

          const bskyProfile: AppBskyActorDefs.ProfileViewDetailed =
            await getBlueskyProfile(resolved);
          nextProfile = {
            displayName: bskyProfile.displayName,
            description: bskyProfile.description,
            avatar: bskyProfile.avatar,
            banner: bskyProfile.banner,
            handle: bskyProfile.handle,
          };
          nextIsBlueskyFallback = true;
        }

        if (!mounted) return;
        const topReleaseRes = await getUserTopReleases(
          resolved,
          normalizeStatsPeriod(nextProfile?.statsDefaultPeriod),
          4,
        ).catch(() => ({
          releases: [],
        }));
        if (!mounted) return;
        setProfile(nextProfile);
        setBadges(badgeRes.items);
        setPlaylists(playlistRes.items);
        setTopReleases(topReleaseRes.releases);
        setGraphSummary(graphSummaryRes);
        setFollowers(followersRes.actors);
        setFollows(followsRes.actors);
        setIsBlueskyFallback(nextIsBlueskyFallback);
        setPosts(postsRes.items);
        setPlays(feedRes.plays);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [actor, pdsAgent?.did]);

  const isSelf = did === pdsAgent?.did;
  const selectedPlayCount = selectedPlayRkeys.size;
  const viewerFollowing = graphSummary.viewerFollowing;
  const canFollow = authStatus === "loggedIn" && !!pdsAgent?.did && !!did;
  async function toggleFollow() {
    if (!canFollow || !pdsAgent?.did || !did || isSelf || followBusy) return;
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
            collection: "fm.teal.alpha.graph.follow",
            rkey,
          },
        );
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
          collection: "fm.teal.alpha.graph.follow",
          record: {
            $type: "fm.teal.alpha.graph.follow",
            subject: did,
            createdAt: new Date().toISOString(),
          },
        },
      );
      setGraphSummary((current) => ({
        ...current,
        followersCount: current.followersCount + 1,
        viewerFollowing: (res.data as { uri?: string }).uri,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFollowBusy(false);
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
      .slice(0, 10)
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
        current.filter((play) => !play.rkey || !selectedPlayRkeys.has(play.rkey)),
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

  return (
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen
        options={{ title: actor || "Profile", headerShown: false }}
      />
      {!did && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load profile: {error}
          </Text>
        </View>
      )}
      {did && (
        <>
          <View className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
            <View className="h-40 bg-primary/30">
              {bannerUrl && (
                <Image
                  source={{ uri: bannerUrl }}
                  className="h-full w-full"
                />
              )}
            </View>
            <View className="-mt-12 px-6 pb-6">
              <ProfileAvatarCluster
                avatarUrl={avatarUrl}
                fallback={profile?.displayName || actor || "T"}
                topReleases={topReleases}
              />
              <Text className="mt-1 font-sans text-3xl font-black">
                {profile?.displayName || actor}
              </Text>
              {profile?.handle && (
                <Text className="font-mono text-sm text-muted-foreground">
                  @{profile.handle}
                </Text>
              )}
              <View className="mt-4 flex-row flex-wrap items-center gap-3">
                <View className="flex-row gap-4 rounded-lg border border-border bg-white/55 px-4 py-2">
                  <Pressable onPress={() => setGraphTab("followers")}>
                    <Text className="font-sans text-lg font-black">
                      {graphSummary.followersCount}
                    </Text>
                    <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                      Followers
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setGraphTab("following")}>
                    <Text className="font-sans text-lg font-black">
                      {graphSummary.followsCount}
                    </Text>
                    <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                      Following
                    </Text>
                  </Pressable>
                </View>
                {isSelf ? (
                  <Button
                    className="flex-row gap-2 self-start"
                    variant="outline"
                    onPress={() => setEditProfileOpen(true)}
                  >
                    <Icon icon={Pencil} size={16} />
                    <Text>Edit profile</Text>
                  </Button>
                ) : (
                  <Button
                    className="flex-row gap-2 self-start"
                    variant={viewerFollowing ? "outline" : "default"}
                    disabled={!canFollow || followBusy}
                    onPress={toggleFollow}
                  >
                    <Icon
                      icon={viewerFollowing ? UserMinus : UserPlus}
                      size={16}
                    />
                    <Text>{viewerFollowing ? "Following" : "Follow"}</Text>
                  </Button>
                )}
              </View>
              {isBlueskyFallback && (
                <View className="mt-4 flex-row gap-3 rounded-lg border border-bsky/30 bg-bsky/10 p-3">
                  <Icon icon={Info} size={18} className="mt-0.5 text-bsky" />
                  <View className="flex-1 gap-1">
                    <Text className="font-bold">Showing Bluesky profile</Text>
                    <Text className="text-sm text-muted-foreground">
                      This listener has not created a Teal profile yet. Their
                      Bluesky profile is shown as a fallback.
                    </Text>
                  </View>
                </View>
              )}
              {profile?.description && (
                <RichText
                  text={profile.description}
                  facets={profile.descriptionFacets}
                  className="mt-4 text-lg"
                />
              )}
              {currentStatus && (
                <View className="mt-4 flex-row items-center gap-2 self-start">
                  <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {currentStatusArt ? (
                      <Image
                        source={{ uri: currentStatusArt }}
                        className="h-full w-full"
                        onError={() => setStatusArtFailed(true)}
                      />
                    ) : (
                      <View className="h-full w-full border border-border bg-muted" />
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      className="font-sans text-sm font-black leading-tight"
                      numberOfLines={1}
                    >
                      Listening to: {currentStatus.trackName}
                    </Text>
                    <Text
                      className="text-xs font-bold text-muted-foreground"
                      numberOfLines={1}
                    >
                      {displayArtists(currentStatus) || "Unknown artist"}
                    </Text>
                  </View>
                </View>
              )}
              {badges.length > 0 && (
                <View className="mt-5">
                  <Text className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">
                    Badges
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {badges.map((assignment) => (
                      <View
                        key={assignment.uri}
                        className="rounded-full border border-border bg-muted px-3 py-1"
                      >
                        <Text className="text-xs font-bold">
                          {assignment.badge.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {isSelf && isBlueskyFallback && (
                <Link href="/onboarding" asChild>
                  <Button className="mt-5 flex-row gap-2 self-start">
                    <Icon icon={UserRoundPlus} size={18} />
                    <Text>Set up Teal profile</Text>
                  </Button>
                </Link>
              )}
            </View>
          </View>
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
          <View className="mb-8">
            <SectionHeading eyebrow="Posts" title="Recent posts" />
            {posts.length === 0 ? (
              <Text className="text-muted-foreground">
                No indexed posts yet.
              </Text>
            ) : (
              <View className="gap-3">
                {posts.map((post) => (
                  <SocialPostCard key={post.uri} post={post} />
                ))}
              </View>
            )}
          </View>
          <View className="mb-8">
            <View className="mb-3 flex-row flex-wrap items-center justify-between gap-3">
              <SectionHeading
                eyebrow="Listening history"
                title="Recent plays"
              />
              {isSelf && plays.length > 0 && (
                <Button
                  variant={bulkEditOpen ? "default" : "outline"}
                  className="flex-row gap-2 self-start"
                  disabled={bulkBusy}
                  onPress={toggleBulkEdit}
                >
                  <Icon
                    icon={bulkEditOpen ? CheckSquare : Square}
                    size={16}
                  />
                  <Text>{bulkEditOpen ? "Done selecting" : "Select plays"}</Text>
                </Button>
              )}
            </View>
            {bulkEditOpen && isSelf && (
              <View className="mb-4 gap-3 rounded-lg border border-border bg-white/70 p-4">
                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  <View>
                    <Text className="font-bold">
                      {selectedPlayCount} selected
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      Bulk actions write directly to your PDS.
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
                        {bulkDeleteArmed ? "Confirm delete" : "Delete selected"}
                      </Text>
                    </Button>
                  </View>
                </View>
                <View className="grid-cols-1 gap-3 md:grid md:grid-cols-2">
                  <View className="gap-2">
                    <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                      Set artists
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
                      Set release
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
            {plays.length === 0 ? (
              <Text className="text-muted-foreground">
                No indexed plays yet.
              </Text>
            ) : (
              plays.slice(0, 10).map((play, index) => (
                <View
                  key={play.uri || `${play.trackName}-${index}`}
                  className={bulkEditOpen ? "flex-row gap-3" : undefined}
                >
                  {bulkEditOpen && (
                    <Button
                      variant={
                        play.rkey && selectedPlayRkeys.has(play.rkey)
                          ? "default"
                          : "outline"
                      }
                      size="icon"
                      className="mt-4"
                      disabled={!play.rkey || bulkBusy}
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
                    <PlayFeedCard play={play} />
                  </View>
                </View>
              ))
            )}
          </View>
          <ProfileStatsSections
            actor={did}
            defaultPeriod={profile?.statsDefaultPeriod}
          />
          <View className="mb-8">
            <SectionHeading
              eyebrow="Social graph"
              title={graphTab === "followers" ? "Followers" : "Following"}
            />
            <View className="mb-4 flex-row gap-2">
              <Button
                size="sm"
                variant={graphTab === "followers" ? "default" : "outline"}
                className="flex-row gap-2"
                onPress={() => setGraphTab("followers")}
              >
                <Icon icon={Users} size={15} />
                <Text>Followers</Text>
              </Button>
              <Button
                size="sm"
                variant={graphTab === "following" ? "default" : "outline"}
                className="flex-row gap-2"
                onPress={() => setGraphTab("following")}
              >
                <Icon icon={UserPlus} size={15} />
                <Text>Following</Text>
              </Button>
            </View>
            {(graphTab === "followers" ? followers : follows).length === 0 ? (
              <Text className="text-muted-foreground">
                {graphTab === "followers"
                  ? "No indexed followers yet."
                  : "No indexed follows yet."}
              </Text>
            ) : (
              <View className="gap-3">
                {(graphTab === "followers" ? followers : follows).map(
                  (actor) => (
                    <GraphActorRow
                      key={actor.did || actor.handle || actor.displayName}
                      actor={actor}
                    />
                  ),
                )}
              </View>
            )}
          </View>
          <View className="mb-8">
            <SectionHeading eyebrow="Collections" title="Playlists" />
            {isSelf && (
              <View className="mb-4">
                <PlaylistCreator
                  onCreated={(playlist) =>
                    setPlaylists((current) => [playlist, ...current])
                  }
                />
              </View>
            )}
            {playlists.length === 0 ? (
              <Text className="text-muted-foreground">
                No indexed playlists yet.
              </Text>
            ) : (
              <View className="gap-3">
                {playlists.map((playlist) => (
                  <Link
                    key={playlist.uri}
                    href={playlistHref(playlist.name, playlist.uri) as any}
                    asChild
                  >
                    <Button
                      variant="outline"
                      className="h-auto items-start justify-start p-4"
                    >
                      <View className="min-w-0">
                        <Text className="font-black" numberOfLines={1}>
                          {playlist.name}
                        </Text>
                        <Text className="text-sm text-muted-foreground">
                          {playlist.itemCount} tracks
                        </Text>
                      </View>
                    </Button>
                  </Link>
                ))}
              </View>
            )}
          </View>
          {isSelf && (
            <View className="mb-8">
              <SectionHeading eyebrow="Admin" title="Badge tools" />
              <BadgeManager
                onAssigned={(assignment) =>
                  setBadges((current) => [assignment, ...current])
                }
              />
            </View>
          )}
        </>
      )}
    </TealShell>
  );
}
