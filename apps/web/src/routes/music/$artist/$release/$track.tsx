import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { useRecordingArt } from "@teal/client/hooks/useRecordingArt";
import { coverArtUrl, displayArtists, getAlbum, getPlayByUri, getSearchResults, getSocialPost } from "@teal/client/teal/api";
import { useViewerDid } from "@teal/client/teal/queries";
import { musicAlbumHref, musicArtistHref, routePart } from "@teal/client/teal/routes";
import { appendTrackHistory } from "@teal/client/teal/trackHistory";
import { A, Button, ErrorNotice, LinkButton, Loading, Screen, Section } from "~/ds";
import { ListenCard } from "~/components/listen/ListenCard";
import { MusicHero } from "~/components/music/MusicHero";
import { AddToPlaylist } from "~/components/playlist/AddToPlaylist";
import { PostCard } from "~/components/today/PostCard";
import { once, pageMeta, serverAwait } from "~/lib/meta";
import { pickStrings } from "~/lib/search";

/** Old links carry only slugs; find the indexed play they meant. */
async function playFromSlugs(artist?: string, release?: string, track?: string) {
  if (!track) throw new Error("missing track");
  const results = await getSearchResults(track.replace(/-/g, " "), 25);
  const match = results.songs.find(
    (song) =>
      routePart(song.trackName) === track &&
      (!release || routePart(song.releaseName) === release) &&
      (!artist || routePart(song.artistName) === artist),
  );
  if (!match?.uri) throw new Error("no match");
  return (await getPlayByUri(match.uri)).play;
}

const playQuery = (uri: string | undefined, artist: string, release: string, track: string) => ({
  queryKey: ["play", uri, artist, release, track] as const,
  queryFn: () => (uri ? getPlayByUri(uri).then((r) => r.play) : playFromSlugs(artist, release, track)),
});

export const Route = createFileRoute("/music/$artist/$release/$track")({
  validateSearch: (search: Record<string, unknown>) => pickStrings(search, "uri", "postUri"),
  loaderDeps: ({ search }) => ({ uri: search.uri }),
  loader: ({ params, deps, context: { queryClient } }) =>
    serverAwait(async () => {
      const play = await queryClient.ensureQueryData(once(playQuery(deps.uri, params.artist, params.release, params.track)));
      return {
        title: `${play.trackName} · ${displayArtists(play) || "Unknown artist"}`,
        description: [play.releaseName, "On Teal"].filter(Boolean).join(" · "),
        image: coverArtUrl(play.releaseMbId, 500),
      };
    }),
  head: ({ loaderData }) => ({ meta: loaderData ? pageMeta(loaderData) : [{ title: "Song · Teal" }] }),
  component: TrackScreen,
});

/** A song: who played it, other listens of it on this album, and the post that linked here. */
function TrackScreen() {
  const params = Route.useParams();
  const { uri, postUri } = Route.useSearch();
  const play = useQuery(playQuery(uri, params.artist, params.release, params.track));
  const p = play.data;
  const recordingArt = useRecordingArt(p);
  const history = useInfiniteQuery({
    queryKey: ["album-history", p?.releaseMbId],
    queryFn: ({ pageParam }) => getAlbum(p!.releaseMbId!, 100, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
    enabled: !!p?.releaseMbId,
  });
  const viewer = useViewerDid();
  const source = useQuery({
    queryKey: ["post", postUri, viewer ?? null],
    queryFn: () => getSocialPost(postUri!, viewer).then((r) => r.post),
    enabled: !!postUri,
  });

  if (play.isLoading) {
    return (
      <Screen back pageTitle="Song">
        <Loading />
      </Screen>
    );
  }
  if (play.isError || !p) {
    return (
      <Screen back pageTitle="Song">
        <ErrorNotice title="This song didn't load" body="It may not be indexed yet, or teal couldn't be reached." onRetry={() => play.refetch()} />
      </Screen>
    );
  }

  const artists = displayArtists(p) || "Unknown artist";
  const firstArtist = p.artists?.[0];
  const related = (history.data?.pages ?? []).reduce((acc, page) => appendTrackHistory(acc, page.plays, p), [] as PlayView[]);

  return (
    <Screen back pageTitle={`${p.trackName} · ${artists}`} width="wide">
      <MusicHero
        releaseMbId={p.releaseMbId}
        imageUri={recordingArt}
        title={p.trackName}
        lines={[
          firstArtist?.artistMbId ? (
            <A href={musicArtistHref(artists, firstArtist.artistMbId)} className="halo text-[18px] font-semibold text-ink hover:underline">
              {artists}
            </A>
          ) : (
            artists
          ),
          p.releaseName && p.releaseMbId ? (
            <A href={musicAlbumHref(artists, p.releaseName, p.releaseMbId)} className="halo text-[16px] text-ink-2 hover:underline">
              {p.releaseName}
            </A>
          ) : (
            (p.releaseName ?? "")
          ),
        ]}
        actions={
          <>
            {p.originUri ? <LinkButton href={p.originUri} target="_blank" label="Listen" icon={ArrowUpRight} /> : null}
            <AddToPlaylist play={p} />
          </>
        }
      />

      {source.data ? (
        <Section title="The post that brought you here">
          <PostCard post={source.data} />
        </Section>
      ) : null}

      <Section title="This listen" panel>
        <ListenCard play={p} last />
      </Section>

      <Section title="More listens on this album" panel>
        {!p.releaseMbId ? (
          <p className="py-2 text-ink-2">This listen has no album, so there's no album history to show.</p>
        ) : history.isLoading ? (
          <Loading className="py-6" />
        ) : history.isError ? (
          <ErrorNotice title="Album history didn't load" onRetry={() => history.refetch()} />
        ) : related.length ? (
          related.map((item, i) => <ListenCard key={item.uri ?? i} play={item} last={i === related.length - 1} showTrack={false} />)
        ) : (
          <p className="py-2 text-ink-2">{history.hasNextPage ? "None in recent album activity." : "No other listens of this song on this album yet."}</p>
        )}
        {history.hasNextPage ? (
          <Button
            label={history.isFetchingNextPage ? "Loading" : "Look further back"}
            variant="secondary"
            size="sm"
            className="mt-3"
            loading={history.isFetchingNextPage}
            onClick={() => history.fetchNextPage()}
          />
        ) : null}
      </Section>
    </Screen>
  );
}
