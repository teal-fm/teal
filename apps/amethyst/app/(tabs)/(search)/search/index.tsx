import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Link, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AmbientSource, Cover, coverUri } from "@/components/ds";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { HeatingShelf } from "@/components/today/HeatingUp";
import { dedupeMoments } from "@/lib/teal/today";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { getProfileImageUrl } from "@/lib/teal/actors";
import {
  getSearchResults,
  getToday,
  searchBlueskyUsers,
  type SearchResults,
} from "@/lib/teal/api";
import {
  musicAlbumHref,
  musicArtistHref,
  musicTrackHref,
} from "@/lib/teal/routes";
import type { AppBskyActorDefs } from "@atproto/api";
import {
  Disc3,
  Mic2,
  Music2,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react-native";

import type { MiniProfileView } from "@teal/lexicons/src/fm/teal/actor/defs";
import type { SongResult } from "@teal/lexicons/src/fm/teal/search/defs";
import type {
  ArtistView,
  ReleaseView,
} from "@teal/lexicons/src/fm/teal/stats/defs";

type SearchTab = "users" | "songs" | "artists" | "albums";
type UserResult = {
  did?: string;
  displayName?: string;
  handle?: string;
  avatar?: string;
  avatarUrl?: string;
};

const EMPTY_RESULTS: SearchResults = {
  users: [],
  songs: [],
  artists: [],
  albums: [],
};

function songHref(song: SongResult) {
  return musicTrackHref(
    song.artistName,
    song.releaseName,
    song.trackName,
    song.uri,
  );
}

function mergeUsers(
  tealUsers: MiniProfileView[],
  blueskyUsers: AppBskyActorDefs.ProfileViewBasic[],
) {
  const merged = new Map<string, UserResult>();
  blueskyUsers.forEach((user) => {
    merged.set(user.did, {
      did: user.did,
      displayName: user.displayName,
      handle: user.handle,
      avatarUrl: user.avatar,
    });
  });
  tealUsers.forEach((user) => {
    if (!user.did) return;
    merged.set(user.did, {
      ...merged.get(user.did),
      ...user,
      handle: user.handle?.replace(/^at:\/\//, ""),
      avatarUrl:
        user.avatar && user.did
          ? getProfileImageUrl(user.did, user.avatar, "avatar")
          : merged.get(user.did)?.avatarUrl,
    });
  });
  return [...merged.values()];
}

function SearchTabButton({
  active,
  count,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  count: number;
  icon: typeof UserRound;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      accessibilityLabel={`${label}, ${count}`}
      className={`min-w-0 flex-1 flex-row items-center justify-center gap-1 border-b-2 px-1 py-3 ${
        active ? "border-ink" : "border-transparent"
      }`}
    >
      <Icon
        icon={icon}
        size={17}
        className={active ? "text-ink" : "text-ink-2"}
      />
      <Text
        className={
          active
            ? "text-sm font-black"
            : "text-sm font-bold text-ink-2"
        }
      >
        {label}
      </Text>
      <Text className="text-xs tabular-nums text-ink-2">{count}</Text>
    </Pressable>
  );
}

function UserRow({ user }: { user: UserResult }) {
  const handle = user.handle?.replace(/^at:\/\//, "");
  return (
    <Link href={`/profile/${handle || user.did}` as any} asChild>
      <Pressable className="flex-row items-center gap-3 border-b border-border px-2 py-4 web:hover:bg-accent/45">
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/60">
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} className="h-full w-full" />
          ) : (
            <Icon
              icon={UserRound}
              size={22}
              className="text-primary-foreground"
            />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black" numberOfLines={1}>
            {user.displayName || handle || user.did}
          </Text>
          <Text
            className="text-xs tabular-nums text-ink-2"
            numberOfLines={1}
          >
            {handle ? `@${handle}` : user.did}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

function SongRow({ song }: { song: SongResult }) {
  return (
    <Link href={songHref(song) as any} asChild>
      <Pressable className="flex-row items-center gap-3 border-b border-border px-2 py-4 web:hover:bg-accent/45">
        <Cover releaseMbId={song.releaseMbId} size={56} radius={8} />
        <View className="min-w-0 flex-1">
          <Text className="font-black" numberOfLines={1}>
            {song.trackName}
          </Text>
          <Text className="text-sm text-ink-2" numberOfLines={1}>
            {song.artistName}
          </Text>
          {!!song.releaseName && (
            <Text
              className="text-xs tabular-nums text-ink-2"
              numberOfLines={1}
            >
              {song.releaseName}
            </Text>
          )}
        </View>
        <Text className="text-xs tabular-nums text-ink-2">
          {song.playCount}
        </Text>
      </Pressable>
    </Link>
  );
}

function MusicEntityRow({
  icon,
  name,
  playCount,
  href,
}: {
  icon: typeof Mic2;
  name?: string;
  playCount?: number;
  href: string;
}) {
  return (
    <Link href={href as any} asChild>
      <Pressable className="flex-row items-center gap-3 border-b border-border px-2 py-4 web:hover:bg-accent/45">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon icon={icon} size={22} className="text-ink-2" />
        </View>
        <Text className="min-w-0 flex-1 font-black" numberOfLines={1}>
          {name || "Unknown"}
        </Text>
        <Text className="text-xs tabular-nums text-ink-2">
          {playCount || 0} {playCount === 1 ? "play" : "plays"}
        </Text>
      </Pressable>
    </Link>
  );
}

/** With nothing typed, Explore shows what all of teal is listening to. */
function Discover() {
  const network = useQuery({
    queryKey: ["today", "network"],
    queryFn: () => getToday(),
    select: (today) => ({
      ...today,
      moments: dedupeMoments(today.moments),
      heatingUp: dedupeMoments(today.heatingUp),
    }),
    refetchInterval: 60_000,
  });
  if (network.isLoading) return <ActivityIndicator className="my-10" />;
  if (network.isError) {
    return (
      <View className="mt-8 items-center gap-3">
        <Text className="text-center text-[15px] text-ink-2">
          What's playing across teal didn't load.
        </Text>
        <Pressable onPress={() => network.refetch()} accessibilityRole="button" className="rounded-full bg-fill px-4 py-2">
          <Text className="font-semibold text-ink">Try again</Text>
        </Pressable>
      </View>
    );
  }
  const now = network.data?.moments ?? [];
  const heating = network.data?.heatingUp ?? [];
  if (now.length === 0 && heating.length === 0) {
    return (
      <Text className="mt-8 text-center text-[15px] text-ink-2">
        Search for listeners, songs, artists, and albums across teal.
      </Text>
    );
  }
  return (
    <View className="-mx-2.5 mt-6">
      <HeatingShelf moments={now} title="Right now on teal" />
      <HeatingShelf moments={heating} title="Heating up across teal" />
    </View>
  );
}

export default function Explore() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("songs");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [blueskyUsers, setBlueskyUsers] = useState<
    AppBskyActorDefs.ProfileViewBasic[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const users = useMemo(
    () => mergeUsers(results.users, blueskyUsers),
    [blueskyUsers, results.users],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY_RESULTS);
      setBlueskyUsers([]);
      setLoading(false);
      setError(undefined);
      return;
    }

    let mounted = true;
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(undefined);
      Promise.all([
        getSearchResults(trimmed, 12),
        searchBlueskyUsers(trimmed, 12).catch(() => ({ actors: [] })),
      ])
        .then(([tealResults, blueskyResults]) => {
          if (!mounted) return;
          setResults(tealResults);
          setBlueskyUsers(blueskyResults.actors);
        })
        .catch((searchError) => {
          if (!mounted) return;
          setResults(EMPTY_RESULTS);
          setBlueskyUsers([]);
          setError(
            searchError instanceof Error
              ? searchError.message
              : String(searchError),
          );
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [query]);

  const counts = {
    users: users.length,
    songs: results.songs.length,
    artists: results.artists.length,
    albums: results.albums.length,
  };
  const hasQuery = query.trim().length >= 2;
  const hasResults = counts[activeTab] > 0;
  return (
    <TealShell pageTitle="Explore">
      <Stack.Screen options={{ title: "Explore", headerShown: false }} />
      <SectionHeading title="Explore" level={1} />
      <View className="overflow-hidden rounded-[26px] border border-glass-edge bg-glass-strong web:backdrop-blur-2xl web:focus-within:border-tint">
        <View className="flex-row items-center gap-3 px-4 py-4">
          <Icon icon={Search} size={23} className="text-ink-2" />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search people and music"
            accessibilityLabel="Search listeners, songs, artists, and albums"
            className="field-in-panel h-12 flex-1 border-0 bg-transparent px-0 text-lg web:focus-visible:ring-0"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loading ? (
            <ActivityIndicator />
          ) : (
            query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                className="h-9 w-9 items-center justify-center rounded-full bg-muted"
              >
                <Icon icon={X} size={18} className="text-ink-2" />
              </Pressable>
            )
          )}
        </View>
        <View accessibilityRole="tablist" className="flex-row overflow-hidden border-t border-border/60">
          <SearchTabButton
            active={activeTab === "users"}
            count={counts.users}
            icon={UsersRound}
            label="People"
            onPress={() => setActiveTab("users")}
          />
          <SearchTabButton
            active={activeTab === "songs"}
            count={counts.songs}
            icon={Music2}
            label="Songs"
            onPress={() => setActiveTab("songs")}
          />
          <SearchTabButton
            active={activeTab === "artists"}
            count={counts.artists}
            icon={Mic2}
            label="Artists"
            onPress={() => setActiveTab("artists")}
          />
          <SearchTabButton
            active={activeTab === "albums"}
            count={counts.albums}
            icon={Disc3}
            label="Albums"
            onPress={() => setActiveTab("albums")}
          />
        </View>
      </View>

      {!hasQuery && <Discover />}
      {/* The top result's cover keeps the backdrop alive while searching. */}
      <AmbientSource
        uri={hasQuery ? coverUri(results.songs[0]?.releaseMbId ?? results.albums[0]?.mbid) : undefined}
      >
      <View
        className={
          hasQuery
            ? "mt-5 overflow-hidden rounded-[26px] border border-glass-edge bg-glass-strong px-3 py-1 web:backdrop-blur-2xl"
            : "hidden"
        }
      >
        {error && (
          <Text className="py-8 text-center font-bold text-destructive">
            Search didn't go through. Check your connection and try again.
          </Text>
        )}
        {hasQuery && !loading && !error && !hasResults && (
          <Text className="py-12 text-center text-ink-2">
            No {activeTab} found for “{query.trim()}”.
          </Text>
        )}
        {activeTab === "users" &&
          users.map((user) => <UserRow key={user.did} user={user} />)}
        {activeTab === "songs" &&
          results.songs.map((song) => <SongRow key={song.uri} song={song} />)}
        {activeTab === "artists" &&
          results.artists.map((artist) => (
            <MusicEntityRow
              key={`${artist.mbid}-${artist.name}`}
              icon={Mic2}
              name={artist.name}
              playCount={artist.playCount}
              href={musicArtistHref(artist.name || "Unknown", artist.mbid)}
            />
          ))}
        {activeTab === "albums" &&
          results.albums.map((album: ReleaseView) => (
            <MusicEntityRow
              key={`${album.mbid}-${album.name}`}
              icon={Disc3}
              name={album.name}
              playCount={album.playCount}
              href={musicAlbumHref(
                "album",
                album.name || "Unknown",
                album.mbid!,
              )}
            />
          ))}
      </View>
      </AmbientSource>
    </TealShell>
  );
}
