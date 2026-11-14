import { useEffect, useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Disc3, Mic2, Music2, Search, UsersRound, X } from "lucide-react-native";
import type { AppBskyActorDefs } from "@atproto/api";
import type { MiniProfileView } from "@teal/lexicons/src/fm/teal/actor/defs";
import { getProfileImageUrl, normalizeHandle } from "@teal/client/teal/actors";
import { getSearchResults, getToday, searchBlueskyUsers } from "@teal/client/teal/api";
import { musicAlbumHref, musicArtistHref, musicTrackHref } from "@teal/client/teal/routes";
import { dedupeMoments } from "@teal/client/teal/today";
import {
  AmbientSource,
  Avatar,
  Cover,
  coverUri,
  ErrorNotice,
  Glass,
  Icon,
  IconButton,
  Loading,
  Row,
  Screen,
  Tabs,
  Text,
  useLayout,
  usePlaceholderColor,
} from "@/components/ds";
import { HeatingShelf } from "@/components/today/HeatingUp";
import { useDebounced } from "@teal/client/hooks/useDebounced";

type Kind = "people" | "songs" | "artists" | "albums";

type Person = { did: string; displayName?: string; handle?: string; avatar?: string };

/** Teal's own profiles win over Bluesky's for the same person. */
function mergePeople(teal: MiniProfileView[], bluesky: AppBskyActorDefs.ProfileViewBasic[]): Person[] {
  const people = new Map<string, Person>();
  for (const user of bluesky) {
    people.set(user.did, { did: user.did, displayName: user.displayName, handle: user.handle, avatar: user.avatar });
  }
  for (const user of teal) {
    if (!user.did) continue;
    const previous = people.get(user.did);
    people.set(user.did, {
      did: user.did,
      displayName: user.displayName || previous?.displayName,
      handle: normalizeHandle(user.handle) || previous?.handle,
      avatar: user.avatar ? getProfileImageUrl(user.did, user.avatar, "avatar") : previous?.avatar,
    });
  }
  return [...people.values()];
}

const plays = (count?: number) => `${count ?? 0} ${count === 1 ? "play" : "plays"}`;

const KINDS = ["people", "songs", "artists", "albums"] as const;

export default function Explore() {
  // The search and tab live in the URL, so browser Back and shared links restore them.
  const params = useLocalSearchParams();
  const kind: Kind = KINDS.includes(params.kind as Kind) ? (params.kind as Kind) : "songs";
  const [query, setQuery] = useState(() => (typeof params.q === "string" ? params.q : ""));
  const term = useDebounced(query.trim());
  const searching = term.length >= 2;
  const layout = useLayout();
  const placeholder = usePlaceholderColor();
  const urlQuery = typeof params.q === "string" ? params.q : "";
  useEffect(() => {
    // Only write when the search changed; writing on the first render navigates before the router mounts.
    if (term !== urlQuery) router.setParams({ q: term || undefined });
  }, [term, urlQuery]);

  const results = useQuery({
    queryKey: ["search", term],
    queryFn: () =>
      Promise.all([
        getSearchResults(term, 12),
        searchBlueskyUsers(term, 12).catch(() => ({ actors: [] })),
      ]).then(([teal, bluesky]) => ({ ...teal, people: mergePeople(teal.users, bluesky.actors) })),
    enabled: searching,
    placeholderData: (previous) => previous,
  });

  const data = searching ? results.data : undefined;
  const counts: Record<Kind, number> = {
    people: data?.people.length ?? 0,
    songs: data?.songs.length ?? 0,
    artists: data?.artists.length ?? 0,
    albums: data?.albums.length ?? 0,
  };
  const topCover = data?.songs[0]?.releaseMbId ?? data?.albums[0]?.mbid;

  return (
    <Screen title="Explore">
      <Glass strong className="web:focus-within:border-tint">
        <View className="flex-row items-center gap-3 px-4 py-2">
          <Icon icon={Search} size={22} className="text-ink-2" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people and music"
            accessibilityLabel="Search listeners, songs, artists, and albums"
            placeholderTextColor={placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            className="field-in-panel h-12 flex-1 font-sans text-[18px] text-ink"
          />
          {query ? <IconButton icon={X} label="Clear search" size={32} onPress={() => setQuery("")} /> : null}
        </View>
        <Tabs
          label="Result type"
          value={kind}
          onChange={(next) => router.setParams({ kind: next })}
          className="border-b-0 border-t"
          // Counts only mean something once there's a search; icons drop on phones so labels fit.
          tabs={[
            { value: "people", label: "People", icon: layout.phone ? undefined : UsersRound, count: searching ? counts.people : undefined },
            { value: "songs", label: "Songs", icon: layout.phone ? undefined : Music2, count: searching ? counts.songs : undefined },
            { value: "artists", label: "Artists", icon: layout.phone ? undefined : Mic2, count: searching ? counts.artists : undefined },
            { value: "albums", label: "Albums", icon: layout.phone ? undefined : Disc3, count: searching ? counts.albums : undefined },
          ]}
        />
      </Glass>

      {!searching ? (
        <Discover />
      ) : results.isError ? (
        <ErrorNotice title="Search didn't go through" onRetry={() => results.refetch()} />
      ) : !data ? (
        <Loading />
      ) : (
        // The top result's cover keeps the backdrop alive while searching.
        <AmbientSource uri={coverUri(topCover)}>
          <Glass className="px-4 py-1">
            {counts[kind] === 0 ? (
              <Text className="py-10 text-center text-ink-2">No {kind} found for “{term}”.</Text>
            ) : kind === "people" ? (
              data.people.map((person, i) => (
                <Row
                  key={person.did}
                  href={`/profile/${person.did}`}
                  leading={<Avatar did={person.did} avatar={person.avatar} name={person.displayName ?? person.handle} size={44} />}
                  title={person.displayName || person.handle || person.did}
                  subtitle={person.handle ? `@${person.handle}` : undefined}
                  divider={i < data.people.length - 1}
                />
              ))
            ) : kind === "songs" ? (
              data.songs.map((song, i) => (
                <Row
                  key={song.uri ?? `${song.trackName}-${i}`}
                  href={musicTrackHref(song.artistName, song.releaseName, song.trackName, song.uri) as never}
                  leading={<Cover releaseMbId={song.releaseMbId} size={52} radius={8} />}
                  title={song.trackName}
                  subtitle={[song.artistName, song.releaseName].filter(Boolean).join(" · ")}
                  meta={plays(song.playCount)}
                  divider={i < data.songs.length - 1}
                />
              ))
            ) : kind === "artists" ? (
              data.artists.map((artist, i) => (
                <Row
                  key={`${artist.mbid}-${artist.name}`}
                  href={musicArtistHref(artist.name || "Unknown", artist.mbid) as never}
                  leading={
                    <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-fill">
                      <Icon icon={Mic2} size={22} className="text-ink-2" />
                    </View>
                  }
                  title={artist.name || "Unknown artist"}
                  meta={plays(artist.playCount)}
                  divider={i < data.artists.length - 1}
                />
              ))
            ) : (
              data.albums.map((album, i) => (
                <Row
                  key={`${album.mbid}-${album.name}`}
                  href={musicAlbumHref("music", album.name || "Unknown", album.mbid ?? "") as never}
                  leading={<Cover releaseMbId={album.mbid} size={52} radius={8} />}
                  title={album.name || "Unknown album"}
                  meta={plays(album.playCount)}
                  divider={i < data.albums.length - 1}
                />
              ))
            )}
          </Glass>
        </AmbientSource>
      )}
    </Screen>
  );
}

/** With nothing typed, Explore shows what all of teal is listening to. */
function Discover() {
  const network = useQuery({
    queryKey: ["today", "network"],
    queryFn: () => getToday(),
    refetchInterval: 60_000,
  });
  const moments = useMemo(() => dedupeMoments(network.data?.moments ?? []), [network.data]);
  const heating = useMemo(() => dedupeMoments(network.data?.heatingUp ?? []), [network.data]);

  if (network.isLoading) return <Loading />;
  if (network.isError) {
    return <ErrorNotice title="What's playing across teal didn't load" onRetry={() => network.refetch()} />;
  }
  if (moments.length === 0 && heating.length === 0) {
    return (
      <Text onBackdrop className="mt-6 text-center text-[15px] text-ink-2">
        Search for listeners, songs, artists, and albums across teal.
      </Text>
    );
  }
  return (
    <View className="-mx-2.5 mt-2">
      <HeatingShelf moments={moments} title="Right now on teal" />
      <HeatingShelf moments={heating} title="Heating up across teal" />
    </View>
  );
}

