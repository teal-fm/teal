import { Linking, Pressable } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react-native";
import { displayArtists, getAlbum, getPlayByUri, getSearchResults, getSocialPost } from "@/lib/teal/api";
import { musicAlbumHref, musicArtistHref, routePart } from "@/lib/teal/routes";
import { appendTrackHistory } from "@/lib/teal/trackHistory";
import { Button, ErrorNotice, Loading, Screen, Section, Text } from "@/components/ds";
import { ListenCard } from "@/components/listen/ListenCard";
import { MusicHero } from "@/components/music/MusicHero";
import { AddToPlaylist } from "@/components/playlist/AddToPlaylist";
import { PostCard } from "@/components/today/PostCard";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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

/** A song: who played it, other listens of it on this album, and the post that linked here. */
export default function TrackScreen() {
  const params = useLocalSearchParams();
  const uri = param(params.uri);
  const postUri = param(params.postUri);

  const play = useQuery({
    queryKey: ["play", uri, param(params.artist), param(params.release), param(params.track)],
    queryFn: () => (uri ? getPlayByUri(uri).then((r) => r.play) : playFromSlugs(param(params.artist), param(params.release), param(params.track))),
  });
  const p = play.data;
  const history = useInfiniteQuery({
    queryKey: ["album-history", p?.releaseMbId],
    queryFn: ({ pageParam }) => getAlbum(p!.releaseMbId!, 100, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
    enabled: !!p?.releaseMbId,
  });
  const source = useQuery({
    queryKey: ["post", postUri, null],
    queryFn: () => getSocialPost(postUri!).then((r) => r.post),
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
  const related = (history.data?.pages ?? []).reduce((acc, page) => appendTrackHistory(acc, page.plays, p), [] as typeof p[]);

  return (
    <Screen back pageTitle={`${p.trackName} · ${artists}`} width="wide">
      <MusicHero
        releaseMbId={p.releaseMbId}
        title={p.trackName}
        lines={[
          firstArtist?.artistMbId ? (
            <Link href={musicArtistHref(artists, firstArtist.artistMbId) as never} asChild>
              <Pressable className="self-start">
                <Text onBackdrop className="text-[18px] font-semibold">
                  {artists}
                </Text>
              </Pressable>
            </Link>
          ) : (
            artists
          ),
          p.releaseName && p.releaseMbId ? (
            <Link href={musicAlbumHref(artists, p.releaseName, p.releaseMbId) as never} asChild>
              <Pressable className="self-start">
                <Text onBackdrop className="text-[16px] text-ink-2">
                  {p.releaseName}
                </Text>
              </Pressable>
            </Link>
          ) : (
            p.releaseName ?? ""
          ),
        ]}
        actions={
          <>
            {p.originUri ? <Button label="Listen" icon={ArrowUpRight} onPress={() => Linking.openURL(p.originUri as string)} /> : null}
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
          <Text className="py-2 text-ink-2">This listen has no album, so there's no album history to show.</Text>
        ) : history.isLoading ? (
          <Loading className="py-6" />
        ) : history.isError ? (
          <ErrorNotice title="Album history didn't load" onRetry={() => history.refetch()} />
        ) : related.length ? (
          related.map((item, i) => <ListenCard key={item.uri ?? i} play={item} last={i === related.length - 1} showTrack={false} />)
        ) : (
          <Text className="py-2 text-ink-2">
            {history.hasNextPage ? "None in recent album activity." : "No other listens of this song on this album yet."}
          </Text>
        )}
        {history.hasNextPage ? (
          <Button
            label={history.isFetchingNextPage ? "Loading" : "Look further back"}
            variant="secondary"
            size="sm"
            className="mt-3"
            loading={history.isFetchingNextPage}
            onPress={() => history.fetchNextPage()}
          />
        ) : null}
      </Section>
    </Screen>
  );
}
