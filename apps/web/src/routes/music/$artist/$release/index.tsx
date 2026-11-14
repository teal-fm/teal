import { infiniteQueryOptions, useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { getAlbum } from "@teal/client/teal/api";
import { countLabel } from "@teal/client/teal/music";
import { musicArtistHref, musicTrackHref } from "@teal/client/teal/routes";
import { cn } from "@teal/client/utils";
import { A, coverUri, ErrorNotice, Icon, Loading, Screen, Section } from "~/ds";
import { ListenCard } from "~/components/listen/ListenCard";
import { MusicHero } from "~/components/music/MusicHero";
import { useEndReached } from "~/hooks/useEndReached";
import { pageMeta, serverAwait } from "~/lib/meta";
import { pickStrings } from "~/lib/search";

const albumQuery = (mbid: string) =>
  infiniteQueryOptions({
    queryKey: ["album", mbid],
    queryFn: ({ pageParam }) => getAlbum(mbid, 30, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
  });

export const Route = createFileRoute("/music/$artist/$release/")({
  validateSearch: (search: Record<string, unknown>) => pickStrings(search, "mbid"),
  loaderDeps: ({ search }) => ({ mbid: search.mbid }),
  loader: ({ deps, context: { queryClient } }) =>
    serverAwait(async () => {
      if (!deps.mbid) return undefined;
      const data = await queryClient.ensureInfiniteQueryData(albumQuery(deps.mbid));
      const album = data.pages[0]?.album;
      if (!album) return undefined;
      return {
        title: `${album.name} · ${album.artistName}`,
        description: `${countLabel(album.playCount, "listen")} on Teal · ${countLabel(album.tracks.length, "track")}`,
        image: coverUri(album.mbid),
      };
    }),
  head: ({ loaderData }) => ({ meta: loaderData ? pageMeta(loaderData) : [{ title: "Album · Teal" }] }),
  component: AlbumScreen,
});

/** An album: its cover, track list, and everyone who has listened to it on teal. */
function AlbumScreen() {
  const { mbid } = Route.useSearch();
  const album = useInfiniteQuery({ ...albumQuery(mbid ?? ""), enabled: !!mbid });
  const more = useEndReached(() => {
    if (album.hasNextPage && !album.isFetchingNextPage) void album.fetchNextPage();
  }, !!album.hasNextPage);

  if (!mbid || album.isError) {
    return (
      <Screen back pageTitle="Album">
        <ErrorNotice title="This album didn't load" onRetry={mbid ? () => album.refetch() : undefined} />
      </Screen>
    );
  }
  const info = album.data?.pages[0]?.album;
  if (!info) {
    return (
      <Screen back pageTitle="Album">
        <Loading />
      </Screen>
    );
  }
  const plays = album.data?.pages.flatMap((p) => p.plays) ?? [];

  return (
    <Screen back pageTitle={info.name} width="wide">
      <MusicHero
        releaseMbId={info.mbid}
        title={info.name}
        lines={[
          info.artistMbid ? (
            <A href={musicArtistHref(info.artistName, info.artistMbid)} className="halo text-[18px] font-semibold text-ink hover:underline">
              {info.artistName}
            </A>
          ) : (
            info.artistName
          ),
          `${countLabel(info.playCount, "listen")} on teal · ${countLabel(info.tracks.length, "track")}`,
        ]}
      />

      <Section title="Tracks" detail={countLabel(info.tracks.length, "track")} panel>
        <ol>
          {info.tracks.map((track, i) => {
            const row = (
              <>
                <span className="w-6 shrink-0 text-center text-[13px] tabular-nums text-ink-2">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 font-semibold text-ink">{track.name}</span>
                  <span className="truncate text-[14px] text-ink-2">{track.artistName}</span>
                </span>
                <span className="text-[13px] tabular-nums text-ink-2">{countLabel(track.playCount, "listen")}</span>
                {track.uri ? <Icon icon={ChevronRight} size={18} className="text-ink-2" /> : null}
              </>
            );
            const rowClass = cn("flex items-center gap-3 py-3", i !== info.tracks.length - 1 && "border-b border-hair");
            return (
              <li key={track.uri || track.recordingMbid || `${track.name}-${i}`}>
                {track.uri ? (
                  <A href={musicTrackHref(track.artistName, info.name, track.name, track.uri)} className={cn(rowClass, "hover:opacity-80")}>
                    {row}
                  </A>
                ) : (
                  <div className={rowClass}>{row}</div>
                )}
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="Who's been listening" detail={countLabel(info.playCount, "listen")} panel>
        {plays.length ? (
          plays.map((play, i) => <ListenCard key={play.uri ?? `${play.trackName}-${i}`} play={play} last={i === plays.length - 1} />)
        ) : (
          <p className="py-2 text-ink-2">No listens yet.</p>
        )}
        <div ref={more} />
        {album.isFetchingNextPage ? <Loading className="py-4" /> : null}
      </Section>
    </Screen>
  );
}
