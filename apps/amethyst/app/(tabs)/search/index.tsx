import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Link, Stack } from "expo-router";
import RightRail from "@/components/songish/RightRail";
import SongishShell, {
  SectionHeading,
} from "@/components/songish/SongishShell";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  getSearchResults,
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

import type { MiniProfileView } from "@teal/lexicons/src/types/fm/teal/alpha/actor/defs";
import type { SongResult } from "@teal/lexicons/src/types/fm/teal/alpha/search/defs";
import type {
  ArtistView,
  ReleaseView,
} from "@teal/lexicons/src/types/fm/teal/alpha/stats/defs";

type SearchTab = "users" | "songs" | "artists" | "albums";
type UserResult = MiniProfileView & { avatarUrl?: string };

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
          ? getImageCdnLink({ did: user.did, hash: user.avatar })
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
      className={`min-w-0 flex-1 flex-row items-center justify-center gap-1 border-b-2 px-1 py-3 ${
        active ? "border-foreground" : "border-transparent"
      }`}
    >
      <Icon
        icon={icon}
        size={17}
        className={active ? "text-foreground" : "text-muted-foreground"}
      />
      <Text
        className={
          active
            ? "text-sm font-black"
            : "text-sm font-bold text-muted-foreground"
        }
      >
        {label}
      </Text>
      <Text className="font-mono text-xs text-muted-foreground">{count}</Text>
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
            className="font-mono text-xs text-muted-foreground"
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
  const art = coverArtUrl(song.releaseMbId);
  return (
    <Link href={songHref(song) as any} asChild>
      <Pressable className="flex-row items-center gap-3 border-b border-border px-2 py-4 web:hover:bg-accent/45">
        <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {art ? (
            <Image source={{ uri: art }} className="h-full w-full" />
          ) : (
            <Icon icon={Music2} size={23} className="text-muted-foreground" />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-black" numberOfLines={1}>
            {song.trackName}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {song.artistName}
          </Text>
          {song.releaseName && (
            <Text
              className="font-mono text-xs text-muted-foreground"
              numberOfLines={1}
            >
              {song.releaseName}
            </Text>
          )}
        </View>
        <Text className="font-mono text-xs text-muted-foreground">
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
          <Icon icon={icon} size={22} className="text-muted-foreground" />
        </View>
        <Text className="min-w-0 flex-1 font-black" numberOfLines={1}>
          {name || "Unknown"}
        </Text>
        <Text className="font-mono text-xs text-muted-foreground">
          {playCount || 0} plays
        </Text>
      </Pressable>
    </Link>
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
    <SongishShell rightRail={<RightRail />}>
      <Stack.Screen options={{ title: "Explore", headerShown: false }} />
      <SectionHeading
        eyebrow="Discovery"
        title="Explore the index"
        detail="LIVE SEARCH"
      />
      <View className="overflow-hidden rounded-lg border border-border bg-card">
        <View className="flex-row items-center gap-3 px-4 py-4">
          <Icon icon={Search} size={23} className="text-muted-foreground" />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search listeners, songs, artists, albums"
            className="h-12 flex-1 border-0 bg-transparent px-0 text-lg web:focus-visible:ring-0"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loading ? (
            <ActivityIndicator />
          ) : (
            query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                className="h-9 w-9 items-center justify-center rounded-full bg-muted"
              >
                <Icon icon={X} size={18} className="text-muted-foreground" />
              </Pressable>
            )
          )}
        </View>
        <View className="flex-row overflow-hidden border-t border-border/60">
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

      <View className="mt-5 overflow-hidden rounded-lg border border-border bg-card px-3 py-1">
        {!hasQuery && (
          <View className="min-h-[20rem] items-center justify-center gap-3 px-8">
            <Icon icon={Search} size={38} className="text-muted-foreground" />
            <Text className="text-center font-sans text-2xl font-black">
              Find something playing
            </Text>
            <Text className="text-center text-muted-foreground">
              Search live Teal plays and listeners across the ATProto network.
            </Text>
          </View>
        )}
        {error && (
          <Text className="py-8 text-center font-bold text-destructive">
            Search failed: {error}
          </Text>
        )}
        {hasQuery && !loading && !error && !hasResults && (
          <Text className="py-12 text-center text-muted-foreground">
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
    </SongishShell>
  );
}
