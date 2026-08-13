import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import PlayFeedCard from "@/components/teal/PlayFeedCard";
import RightRail from "@/components/teal/RightRail";
import TealShell, {
  SectionHeading,
} from "@/components/teal/TealShell";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { coverArtUrl, getAlbum } from "@/lib/teal/api";
import { musicArtistHref, musicTrackHref } from "@/lib/teal/routes";
import { ChevronRight, Disc3, Music2 } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/feed/defs";
import type { AlbumView } from "@teal/lexicons/src/types/fm/teal/music/defs";

export default function AlbumDetail() {
  const params = useLocalSearchParams();
  const mbid = Array.isArray(params.mbid) ? params.mbid[0] : params.mbid;
  const [album, setAlbum] = useState<AlbumView | null>(null);
  const [plays, setPlays] = useState<PlayView[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string>();
  const [artFailed, setArtFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    if (!mbid) {
      setError("Missing MusicBrainz release ID");
      return;
    }
    getAlbum(mbid, 30)
      .then((page) => {
        if (!mounted) return;
        setAlbum(page.album);
        setPlays(page.plays);
        setCursor(page.cursor);
      })
      .catch((loadError) => {
        if (mounted) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, [mbid]);

  const loadMore = useCallback(() => {
    if (!mbid || !cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    getAlbum(mbid, 30, cursor)
      .then((page) => {
        setPlays((current) => {
          const knownUris = new Set(current.map((play) => play.uri));
          return [
            ...current,
            ...page.plays.filter(
              (play) => !play.uri || !knownUris.has(play.uri),
            ),
          ];
        });
        setCursor(page.cursor);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [cursor, mbid]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      if (
        contentSize.height - (contentOffset.y + layoutMeasurement.height) <
        800
      ) {
        loadMore();
      }
    },
    [loadMore],
  );

  const art = artFailed ? undefined : coverArtUrl(album?.mbid, 500);

  return (
    <TealShell rightRail={<RightRail />} onScroll={handleScroll}>
      <Stack.Screen
        options={{ title: album?.name || "Album", headerShown: false }}
      />
      {!album && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load album: {error}
          </Text>
        </View>
      )}
      {album && (
        <>
          <View className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
            <View className="h-40 bg-muted">
              {art && (
                <Image
                  source={{ uri: art }}
                  className="h-full w-full opacity-40"
                  onError={() => setArtFailed(true)}
                />
              )}
            </View>
            <View className="-mt-10 flex-row items-end gap-4 px-5 pb-7">
              <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-muted md:h-28 md:w-28">
                {art ? (
                  <Image
                    source={{ uri: art }}
                    className="h-full w-full"
                    onError={() => setArtFailed(true)}
                  />
                ) : (
                  <Icon
                    icon={Disc3}
                    size={42}
                    className="text-muted-foreground"
                  />
                )}
              </View>
              <View className="min-w-0 flex-1 pb-1">
                <Text className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  Album
                </Text>
                <Text
                  className="font-sans text-2xl font-black md:text-3xl"
                  numberOfLines={3}
                >
                  {album.name}
                </Text>
                {album.artistMbid ? (
                  <Link
                    href={
                      musicArtistHref(album.artistName, album.artistMbid) as any
                    }
                    asChild
                  >
                    <Pressable>
                      <Text className="font-bold text-muted-foreground">
                        {album.artistName}
                      </Text>
                    </Pressable>
                  </Link>
                ) : (
                  <Text className="font-bold text-muted-foreground">
                    {album.artistName}
                  </Text>
                )}
                <Text className="font-mono text-xs text-muted-foreground">
                  {album.playCount} indexed listens
                </Text>
              </View>
            </View>
          </View>

          <SectionHeading
            eyebrow="Release"
            title="Track list"
            detail={`${album.tracks.length} TRACKS`}
          />
          <View className="mb-10 overflow-hidden rounded-lg border border-border bg-card px-3">
            {album.tracks.map((track) => (
              <Link
                key={`${track.recordingMbid}-${track.uri}`}
                href={
                  musicTrackHref(
                    track.artistName,
                    album.name,
                    track.name,
                    track.uri,
                  ) as any
                }
                asChild
              >
                <Pressable className="flex-row items-center gap-3 border-b border-border/70 py-4">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Icon
                      icon={Music2}
                      size={18}
                      className="text-muted-foreground"
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-black" numberOfLines={2}>
                      {track.name}
                    </Text>
                    <Text
                      className="text-sm text-muted-foreground"
                      numberOfLines={1}
                    >
                      {track.artistName}
                    </Text>
                  </View>
                  <Text className="font-mono text-xs text-muted-foreground">
                    {track.playCount}
                  </Text>
                  <Icon
                    icon={ChevronRight}
                    size={18}
                    className="text-muted-foreground"
                  />
                </Pressable>
              </Link>
            ))}
          </View>

          <SectionHeading
            eyebrow="Across the network"
            title="Listens"
            detail={`${album.playCount} TOTAL`}
          />
          {plays.map((play, index) => (
            <PlayFeedCard
              key={play.uri || `${play.trackName}-${index}`}
              play={play}
            />
          ))}
          {loadingMore && (
            <View className="items-center justify-center py-5">
              <ActivityIndicator />
            </View>
          )}
          {plays.length > 0 && !cursor && (
            <Text className="pb-6 text-center font-mono text-xs text-muted-foreground">
              You reached the beginning of this album's indexed listens.
            </Text>
          )}
        </>
      )}
    </TealShell>
  );
}
