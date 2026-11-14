import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Disc3, Mic2, Music2, Search, UsersRound, X } from "lucide-react";
import type { AppBskyActorDefs } from "@atproto/api";
import type { MiniProfileView } from "@teal/lexicons/src/fm/teal/actor/defs";
import { useDebounced } from "@teal/client/hooks/useDebounced";
import { getProfileImageUrl, normalizeHandle } from "@teal/client/teal/actors";
import { getSearchResults, getToday, searchBlueskyUsers } from "@teal/client/teal/api";
import { musicAlbumHref, musicArtistHref, musicTrackHref } from "@teal/client/teal/routes";
import { dedupeMoments } from "@teal/client/teal/today";
import { AmbientSource, Avatar, Cover, coverUri, ErrorNotice, Glass, Icon, IconButton, Loading, Row, Screen, Tabs } from "~/ds";
import { HeatingShelf } from "~/components/today/HeatingUp";
import { useLayout } from "~/lib/media";

const KINDS = ["people", "songs", "artists", "albums"] as const;
type Kind = (typeof KINDS)[number];

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): { q?: string; kind?: Kind } => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    kind: KINDS.includes(search.kind as Kind) ? (search.kind as Kind) : undefined,
  }),
  head: () => ({ meta: [{ title: "Explore · Teal" }] }),
  component: Explore,
});

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

function Explore() {
  // The search and tab live in the URL, so browser Back and shared links restore them.
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const kind: Kind = params.kind ?? "songs";
  const { phone } = useLayout();
  const [query, setQuery] = useState(params.q ?? "");
  const term = useDebounced(query.trim());
  const searching = term.length >= 2;
  useEffect(() => {
    if (term !== (params.q ?? "")) void navigate({ search: (prev) => ({ ...prev, q: term || undefined }), replace: true, resetScroll: false });
  }, [term, params.q, navigate]);

  const results = useQuery({
    queryKey: ["search", term],
    queryFn: () =>
      Promise.all([getSearchResults(term, 12), searchBlueskyUsers(term, 12).catch(() => ({ actors: [] }))]).then(([teal, bluesky]) => ({
        ...teal,
        people: mergePeople(teal.users, bluesky.actors),
      })),
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
      <Glass strong className="focus-within:border-tint">
        <form role="search" onSubmit={(event) => event.preventDefault()} className="flex items-center gap-3 px-4 py-2">
          <Icon icon={Search} size={22} className="text-ink-2" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people and music"
            aria-label="Search listeners, songs, artists, and albums"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="field-in-panel h-12 min-w-0 flex-1 bg-transparent text-[18px] text-ink outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? <IconButton icon={X} label="Clear search" size={32} onClick={() => setQuery("")} /> : null}
        </form>
        <Tabs
          label="Result type"
          value={kind}
          onChange={(next) => void navigate({ search: (prev) => ({ ...prev, kind: next }), replace: true, resetScroll: false })}
          className="border-t border-b-0"
          // Icons drop on phones so the labels fit.
          tabs={[
            { value: "people", label: "People", icon: phone ? undefined : UsersRound, count: searching ? counts.people : undefined },
            { value: "songs", label: "Songs", icon: phone ? undefined : Music2, count: searching ? counts.songs : undefined },
            { value: "artists", label: "Artists", icon: phone ? undefined : Mic2, count: searching ? counts.artists : undefined },
            { value: "albums", label: "Albums", icon: phone ? undefined : Disc3, count: searching ? counts.albums : undefined },
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
          <Glass className="px-4 py-1" aria-live="polite">
            {counts[kind] === 0 ? (
              <p className="py-10 text-center text-ink-2">
                No {kind} found for “{term}”.
              </p>
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
                  href={musicTrackHref(song.artistName, song.releaseName, song.trackName, song.uri)}
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
                  href={musicArtistHref(artist.name || "Unknown", artist.mbid)}
                  leading={
                    <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-fill">
                      <Icon icon={Mic2} size={22} className="text-ink-2" />
                    </span>
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
                  href={musicAlbumHref("music", album.name || "Unknown", album.mbid ?? "")}
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
  if (network.isError) return <ErrorNotice title="What's playing across teal didn't load" onRetry={() => network.refetch()} />;
  if (moments.length === 0 && heating.length === 0) {
    return <p className="halo mt-6 text-center text-[15px] text-ink-2">Search for listeners, songs, artists, and albums across teal.</p>;
  }
  return (
    <div className="-mx-2.5 mt-2">
      <HeatingShelf moments={moments} title="Right now on teal" />
      <HeatingShelf moments={heating} title="Heating up across teal" />
    </div>
  );
}
