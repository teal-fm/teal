import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react-native";
import { getAlbum } from "@teal/client/teal/api";
import { countLabel } from "@teal/client/teal/music";
import { musicArtistHref, musicTrackHref } from "@teal/client/teal/routes";
import { ErrorNotice, Glass, Icon, Loading, Screen, Section, Text } from "@/components/ds";
import { ListenCard } from "@/components/listen/ListenCard";
import { MusicHero } from "@/components/music/MusicHero";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** An album: its cover, track list, and everyone who has listened to it on teal. */
export default function AlbumScreen() {
  const mbid = param(useLocalSearchParams().mbid);
  const album = useInfiniteQuery({
    queryKey: ["album", mbid],
    queryFn: ({ pageParam }) => getAlbum(mbid!, 30, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
    enabled: !!mbid,
  });

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
    <Screen
      back
      pageTitle={info.name}
      width="wide"
      onScroll={(event) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const nearEnd = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 800;
        if (nearEnd && album.hasNextPage && !album.isFetchingNextPage) void album.fetchNextPage();
      }}
    >
      <MusicHero
        releaseMbId={info.mbid}
        title={info.name}
        lines={[
          info.artistMbid ? (
            <Link href={musicArtistHref(info.artistName, info.artistMbid) as never} asChild>
              <Pressable className="self-start">
                <Text onBackdrop className="text-[18px] font-semibold">
                  {info.artistName}
                </Text>
              </Pressable>
            </Link>
          ) : (
            info.artistName
          ),
          `${countLabel(info.playCount, "listen")} on teal · ${countLabel(info.tracks.length, "track")}`,
        ]}
      />

      <Section title="Tracks" detail={countLabel(info.tracks.length, "track")} panel>
        {info.tracks.map((track, i) => {
          const row = (
            <View className={i === info.tracks.length - 1 ? "flex-row items-center gap-3 py-3" : "flex-row items-center gap-3 border-b border-hair py-3"}>
              <Text className="w-6 text-center text-[13px] tabular-nums text-ink-2">{i + 1}</Text>
              <View className="min-w-0 flex-1">
                <Text className="font-semibold" numberOfLines={2}>
                  {track.name}
                </Text>
                <Text className="text-[14px] text-ink-2" numberOfLines={1}>
                  {track.artistName}
                </Text>
              </View>
              <Text className="text-[13px] tabular-nums text-ink-2">{countLabel(track.playCount, "listen")}</Text>
              {track.uri ? <Icon icon={ChevronRight} size={18} className="text-ink-2" /> : null}
            </View>
          );
          return track.uri ? (
            <Link key={track.uri} href={musicTrackHref(track.artistName, info.name, track.name, track.uri) as never} asChild>
              <Pressable className="web:hover:opacity-80">{row}</Pressable>
            </Link>
          ) : (
            <View key={track.recordingMbid || `${track.name}-${i}`}>{row}</View>
          );
        })}
      </Section>

      <Section title="Who's been listening" detail={countLabel(info.playCount, "listen")} panel>
        {plays.length ? (
          plays.map((play, i) => <ListenCard key={play.uri ?? `${play.trackName}-${i}`} play={play} last={i === plays.length - 1} />)
        ) : (
          <Text className="py-2 text-ink-2">No listens yet.</Text>
        )}
        {album.isFetchingNextPage ? <Loading className="py-4" /> : null}
      </Section>
    </Screen>
  );
}
