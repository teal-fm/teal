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
  getSocialFeed,
  coverArtUrl,
  displayArtists,
  getRecordingCoverArtUrl,
  type GraphSummaryView,
  type SocialBadgeAssignmentView,
  type SocialPostView,
  type SocialPlaylistView,
  XrpcError,
} from "@/lib/teal/api";
import { useStore } from "@/stores/mainStore";
import { playlistHref } from "@/lib/teal/routes";
import type { AppBskyActorDefs } from "@atproto/api";
import {
  Info,
  Pencil,
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
        setGraphSummary({ followersCount: 0, followsCount: 0 });
        setFollowers([]);
        setFollows([]);
        setPosts([]);
        setPlays([]);
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
        setProfile(nextProfile);
        setBadges(badgeRes.items);
        setPlaylists(playlistRes.items);
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
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  className="h-24 w-24 rounded-lg border-4 border-background bg-primary"
                />
              ) : (
                <View className="h-24 w-24 items-center justify-center rounded-lg border-4 border-background bg-primary">
                  <Text className="text-4xl font-black text-primary-foreground">
                    {(profile?.displayName || actor || "T").slice(0, 1)}
                  </Text>
                </View>
              )}
              <Text className="mt-3 font-sans text-3xl font-black">
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
            <SectionHeading eyebrow="Listening history" title="Recent plays" />
            {plays.length === 0 ? (
              <Text className="text-muted-foreground">
                No indexed plays yet.
              </Text>
            ) : (
              plays.slice(0, 10).map((play, index) => (
                <PlayFeedCard
                  key={play.uri || `${play.trackName}-${index}`}
                  play={play}
                />
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
